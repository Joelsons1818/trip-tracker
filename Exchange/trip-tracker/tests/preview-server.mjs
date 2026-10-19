// Local UI fixture: no API request can reach Google Sheets through this server.
// Run alongside `npm run build && npm run start -- --port 3002`; open http://127.0.0.1:3001.
import http from 'node:http';
const excludedIds = new Set();
const date = `${new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })}T12:00:00.000Z`;
const transactions = [
  {id:'demo-deposit', type:'Deposit', person:'Daniel', amountUSD:1000, date},
  {id:'demo-regular', type:'Expense', person:'Daniel', amountUSD:100, date, description:'Mercado (teste)', category:'Mercado'},
  {id:'demo-exception', type:'Expense', person:'Daniel', amountUSD:400, date, description:'Compra excepcional (teste)', category:'Casa EUA'},
];
http.createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://127.0.0.1:3001').pathname;
  const json = (body, status = 200) => { res.writeHead(status, {'Content-Type':'application/json', 'Cache-Control':'no-store'}); res.end(JSON.stringify(body)); };
  if (pathname.startsWith('/api/')) {
    if (pathname === '/api/analysis-preferences') {
      if (req.method === 'GET') return json({excludedIds:[...excludedIds]});
      if (req.method === 'PUT') {
        let raw = ''; for await (const chunk of req) raw += chunk;
        const body = JSON.parse(raw);
        if (body.excluded) excludedIds.add(body.transactionId); else excludedIds.delete(body.transactionId);
        return json(body);
      }
    }
    if (req.method === 'GET' && pathname === '/api/transactions') return json({transactions});
    if (req.method === 'GET' && pathname === '/api/categories') return json({categories:[{id:'Mercado',name:'Mercado',codebook:'Teste'},{id:'Casa EUA',name:'Casa EUA',codebook:'Teste'}]});
    return json({error:'Gravação bloqueada neste ambiente de teste.'}, 403);
  }
  if (req.method !== 'GET') return json({error:'Blocked'}, 403);
  const proxy = http.request({hostname:'127.0.0.1',port:3002,path:req.url,method:'GET',headers:{...req.headers,host:'127.0.0.1:3002'}}, upstream => {
    res.writeHead(upstream.statusCode,upstream.headers); upstream.pipe(res);
  });
  proxy.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end('Start the built app on port 3002.'); });
  proxy.end();
}).listen(3001,'127.0.0.1',()=>console.log('Safe fixture preview: http://127.0.0.1:3001 (all API calls isolated in memory)'));
