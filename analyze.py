import json, re

RAW = '/home/mike/Desktop/wast/dayyan/sih_problem_statements.json'
OUT = '/home/mike/Desktop/wast/dayyan/site/data.js'

data = json.load(open(RAW, encoding='utf-8'))

# Tech keyword -> complexity weight (how hard it is to build)
TECH = {
    'ai': ['ai', 'artificial intelligence', 'machine learning', 'ml ', 'deep learning', 'neural', 'llm', 'genai', 'generative', 'predictive model', 'computer vision', 'nlp', 'natural language', 'chatbot', 'recommendation'],
    'iot': ['iot', 'internet of things', 'sensor', 'embedded', 'arduino', 'raspberry', 'microcontroller'],
    'blockchain': ['blockchain', 'smart contract', 'web3', 'distributed ledger', 'cryptograph'],
    'gis': ['gis', 'gps', 'satellite', 'remote sensing', 'geospatial', 'mapping', 'geo-tagged', 'geotag'],
    'drone': ['drone', 'uav', 'robot', 'robotic', 'autonomous'],
    'xr': ['ar/', 'vr ', 'augmented reality', 'virtual reality', 'xr', 'metaverse'],
    'cloud': ['cloud', 'saas', 'api', 'web app', 'mobile app', 'dashboard'],
    'realtime': ['real-time', 'real time', 'live ', 'streaming', 'edge computing'],
    'data': ['big data', 'data analytics', 'data lake', 'anomaly detection', 'forecast'],
    'security': ['cyber', 'encryption', 'authentication', 'vulnerability', 'zero trust'],
}

# Requirements letter-count a., b., c. ...
def count_reqs(text):
    return len(re.findall(r'(?:^|\n)\s*[a-z]\)', text))

def detect_tech(text):
    t = text.lower()
    found = []
    for cat, kws in TECH.items():
        if any(k in t for k in kws):
            found.append(cat)
    return found

def complexity(techs, desc_len, reqs):
    hard = {'ai','blockchain','drone','xr'}
    med  = {'iot','gis','realtime','security','data'}
    score = 0
    score += 14 * len([t for t in techs if t in hard])
    score += 8  * len([t for t in techs if t in med])
    score += 4  * len([t for t in techs if t in {'cloud'}])
    score += min(desc_len / 350.0, 18)      # longer spec = more involved
    score += min(reqs * 1.6, 14)            # more sub-requirements
    return max(5, min(100, round(score)))

for r in data:
    desc = r.get('Description', '') or ''
    techs = detect_tech(desc)
    reqs = count_reqs(desc)
    cscore = complexity(techs, len(desc), reqs)
    # level
    if cscore < 38:
        level = 'Easy'
    elif cscore < 66:
        level = 'Medium'
    else:
        level = 'Hard'

    # Winnability: sweet spot around medium complexity (finishable + non-trivial),
    # rewards clear deliverables ("Expected Solution"), penalises exotic stacks a bit,
    # software is easier for typical student teams than hardware.
    w = 100 - abs(cscore - 56) * 1.15
    if 'expected solution' in desc.lower():
        w += 8
    if reqs >= 4:
        w += 4
    exotic = len([t for t in techs if t in {'blockchain','drone','xr','ai'}])
    w -= exotic * 2
    if r['Category'] == 'Hardware':
        w -= 6   # needs physical infra / components
    w = max(5, min(100, round(w)))

    if w >= 70:
        wtier = 'High'
    elif w >= 50:
        wtier = 'Medium'
    else:
        wtier = 'Low'

    # submissions parse -> competition
    m = re.search(r'(\d+)/(\d+)', r.get('Submitted Idea(s) Count',''))
    submitted = int(m.group(1)) if m else 0

    r['tech_stack'] = techs
    r['requirements_count'] = reqs
    r['complexity_score'] = cscore
    r['complexity_level'] = level
    r['winnability_score'] = w
    r['winnability_tier'] = wtier
    r['submitted_ideas'] = submitted

# write as JS
with open(OUT, 'w', encoding='utf-8') as f:
    f.write('window.PROBLEM_DATA = ')
    json.dump(data, f, ensure_ascii=False, indent=1)
    f.write(';\n')

print('Enriched', len(data), 'records ->', OUT)
from collections import Counter
print('Complexity:', Counter(r['complexity_level'] for r in data))
print('Winnability:', Counter(r['winnability_tier'] for r in data))
