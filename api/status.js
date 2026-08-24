// Shared status store backed by Upstash Redis (REST API). No SDK required.
// Create a Redis database via Vercel Storage -> Marketplace -> Upstash,
// link it to this project. It injects UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN.

const KEY = 'ps_status';

async function upstash(args){
  const r = await fetch(process.env.KV_REST_API_URL, {
    method:'POST',
    headers:{
      Authorization:`Bearer ${process.env.KV_REST_API_TOKEN}`,
      'Content-Type':'application/json'
    },
    body: JSON.stringify(args)
  });
  return r.json();
}

async function getAll(){
  const res = await upstash(['GET', KEY]);
  if(!res || res.result == null) return {};
  try { return JSON.parse(res.result); } catch { return {}; }
}

export default async function handler(req, res){
  if(req.method === 'GET'){
    return res.status(200).json(await getAll());
  }
  if(req.method === 'POST'){
    let body = req.body;
    if(typeof body === 'string'){ try { body = JSON.parse(body); } catch {} }
    const ps = body && body.ps;
    const status = body && body.status;
    if(!ps) return res.status(400).json({ error:'ps required' });

    const all = await getAll();
    if(!status) delete all[ps]; else all[ps] = status;
    await upstash(['SET', KEY, JSON.stringify(all)]);
    return res.status(200).json(all);
  }
  return res.status(405).json({ error:'method not allowed' });
}
