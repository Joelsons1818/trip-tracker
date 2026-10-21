import test from 'node:test';
import assert from 'node:assert/strict';
import { getCardBalance, getCashBalance, belongsToWallet, materializeCard, prepareCardEvent, readCardEvents } from '../src/lib/card.ts';
import { getSpendingTransactions, partitionAnalysisExpenses, sumAmounts, calculateAverages } from '../src/lib/analysis.ts';
import { readCardLedger, appendCardEvent } from '../src/lib/card-store.ts';
const date = '2026-10-21T12:00:00.000Z';
const purchase = (id, amountUSD, category) => ({id,amountUSD,category,person:'Cartão',type:'Expense',date,description:category});
const a = purchase('card-a',100,'Mercado');
const b = purchase('card-b',50,'Restaurante');
const initial = [{eventId:'a',id:a.id,operation:'save',transaction:a},{eventId:'b',id:b.id,operation:'save',transaction:b}];
const bank = {id:'bank',person:'BofA',type:'Deposit',amountUSD:1000,date};

test('card purchases accrue debt/categories, payment moves BofA once and zeroes debt', () => {
  const payment = prepareCardEvent({action:'pay',requestId:'request',revision:'v1',date:'2026-11-01T12:00:00.000Z'},initial,'v1');
  const before = [bank,...materializeCard(initial)];
  const after = [bank,...materializeCard([...initial,payment])];
  assert.equal(getCardBalance(before),150);
  assert.equal(getCashBalance(before,'BofA'),1000);
  assert.equal(getCardBalance(after),0);
  assert.equal(getCashBalance(after,'BofA'),850);
  assert.equal(getCashBalance(after),850);
  const spending = getSpendingTransactions(after).expenses;
  assert.equal(sumAmounts(spending),150);
  assert.equal(spending.filter(tx=>tx.category==='Mercado')[0].amountUSD,100);
  assert.equal(calculateAverages(spending,2026,9,2026,9,new Date(2026,10,5)).total,150);
  assert.equal(calculateAverages(spending,2026,10,2026,10,new Date(2026,10,5)).total,0);
  assert.equal(after.filter(tx=>belongsToWallet(tx,'BofA')&&tx.type==='CardPayment').length,1);
  assert.equal(after.filter(tx=>belongsToWallet(tx,'Cartão')&&tx.type==='CardPayment').length,1);
});
test('retry and simultaneous full-payment requests cannot double charge', () => {
  const command = {action:'pay',requestId:'first',revision:'v1',date};
  const one = prepareCardEvent(command,initial,'v1');
  const two = prepareCardEvent({...command,requestId:'second'},initial,'v1');
  assert.equal(one.eventId,two.eventId);
  assert.equal(getCashBalance([bank,...materializeCard([...initial,one,two])],'BofA'),850);
  assert.equal(prepareCardEvent(command,[...initial,one],'v2'),null);
  assert.throws(()=>prepareCardEvent({...command,revision:'v2'},[...initial,one],'v2'),/saldo/);
});
test('editing/deleting paid purchases creates credit without changing BofA; payment changes affect both', () => {
  const payment = prepareCardEvent({action:'pay',requestId:'p',revision:'v1',date},initial,'v1');
  const paid = [...initial,payment];
  const edit = prepareCardEvent({action:'edit',requestId:'e',revision:'v2',transaction:{...a,amountUSD:80}},paid,'v2');
  assert.equal(getCardBalance(materializeCard([...paid,edit])),-20);
  assert.equal(getCashBalance([bank,...materializeCard([...paid,edit])],'BofA'),850);
  const deletion = prepareCardEvent({action:'delete',requestId:'d',revision:'v3',id:b.id},[...paid,edit],'v3');
  assert.equal(getCardBalance(materializeCard([...paid,edit,deletion])),-70);
  const paymentEdit = prepareCardEvent({action:'edit',requestId:'pe',revision:'v4',transaction:{...payment.transaction,amountUSD:100}},paid,'v4');
  assert.equal(getCardBalance(materializeCard([...paid,paymentEdit])),50);
  assert.equal(getCashBalance([bank,...materializeCard([...paid,paymentEdit])],'BofA'),900);
  const undo = prepareCardEvent({action:'delete',requestId:'undo',revision:'v5',id:payment.id},paid,'v5');
  assert.equal(getCardBalance(materializeCard([...paid,undo])),150);
  assert.equal(getCashBalance([bank,...materializeCard([...paid,undo])],'BofA'),1000);
});
test('exclusion changes analysis only, purchases and balances survive', () => {
  const rows = materializeCard(initial);
  const {included} = partitionAnalysisExpenses(getSpendingTransactions(rows).expenses,new Set([a.id]));
  assert.equal(sumAmounts(included),50);
  assert.equal(getCardBalance(rows),150);
  assert.equal(sumAmounts(partitionAnalysisExpenses(rows,new Set()).included),150);
});
test('stale requests, invalid inputs and mutation of type are rejected', () => {
  assert.throws(()=>prepareCardEvent({action:'pay',requestId:'x',revision:'old',date},initial,'new'),/mudaram/);
  for(const amountUSD of [0,-1,NaN,Infinity,1.234]) assert.throws(()=>prepareCardEvent({action:'purchase',requestId:'x',revision:'v',transaction:{...a,amountUSD}},[],'v'));
  assert.throws(()=>prepareCardEvent({action:'purchase',requestId:'x',revision:'v',transaction:{...a,date:'2026-02-30T12:00:00.000Z'}},[],'v'));
  assert.throws(()=>prepareCardEvent({action:'edit',requestId:'x',revision:'v',transaction:{...a,type:'CardPayment'}},initial,'v'));
});
test('new purchases after payment start a new outstanding balance', () => {
  const p=prepareCardEvent({action:'pay',requestId:'p',revision:'v',date},initial,'v');
  const next=prepareCardEvent({action:'purchase',requestId:'n',revision:'v2',transaction:purchase('card-new',20,'Mercado')},[...initial,p],'v2');
  assert.equal(getCardBalance(materializeCard([...initial,p,next])),20);
});
test('card storage reads without writing and appends only to its own tab; deletion preserves ledger', async () => {
  let exists=false; const rows=[['eventId','transactionId','operation','payload','createdAt']]; const writes=[];
  const sheets={spreadsheets:{
    get:async()=>({data:{sheets:exists?[{properties:{title:'CartaoCredito'}}]:[]}}),
    batchUpdate:async ({requestBody})=>{assert.equal(requestBody.requests[0].addSheet.properties.title,'CartaoCredito');assert.equal(requestBody.requests.length,2);exists=true;writes.push('create');},
    values:{get:async({range})=>{assert.equal(range,"'CartaoCredito'!A:E");return {data:{values:rows}};},
      append:async({range,valueInputOption,requestBody})=>{assert.equal(range,"'CartaoCredito'!A:E");assert.equal(valueInputOption,'RAW');rows.push(...requestBody.values);writes.push('append');}}
  }};
  assert.deepEqual((await readCardLedger(sheets,'test')).rows,[]);
  assert.deepEqual(writes,[]);
  await appendCardEvent(sheets,'test',initial[0]);
  await appendCardEvent(sheets,'test',{eventId:'delete',id:a.id,operation:'delete'});
  assert.deepEqual(materializeCard(readCardEvents((await readCardLedger(sheets,'test')).rows)),[]);
  assert.equal(rows.length,3);
  assert.deepEqual(writes,['create','append','append']);
});
