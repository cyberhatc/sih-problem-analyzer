import json, re
from bs4 import BeautifulSoup

with open('/home/mike/Desktop/wast/dayyan/sihproblemstmt', 'r', encoding='utf-8') as f:
    content = f.read()
soup = BeautifulSoup(content, 'html.parser')
rows = soup.find('table', {'id': 'dataTablePS'}).find('tbody').find_all('tr')

def clean(t): return re.sub(r'\s+', ' ', t or '').strip()

def grab_link(td):
    if not td: return ''
    a = td.find('a')
    if a and a.get('href') and a.get('href').strip() not in ('', '#'):
        return a.get('href').strip().rstrip('.,);]')
    txt = clean(td.get_text(' '))
    # bare url in text (stop at whitespace/HTML/trailing punctuation)
    m = re.search(r'https?://[^\s<>"\'\)\]]+', txt)
    return m.group(0).rstrip('.,);]') if m else ''

out = []
for row in rows:
    cells = row.find_all('td', recursive=False)
    if len(cells) < 7: continue
    sno = clean(cells[0].get_text())
    org = clean(cells[1].get_text())
    title_a = cells[2].find('a', recursive=False)
    title = clean(title_a.get_text()) if title_a else clean(cells[2].get_text()).split('\n')[0]
    category = clean(cells[3].get_text())
    ps_number = clean(cells[4].get_text())
    ideas = clean(cells[5].get_text())
    theme = clean(cells[6].get_text())
    deadline = clean(cells[7].get_text()) if len(cells) > 7 else ''

    youtube = dataset = contact = description = department = ''
    modal = cells[2].find('div', class_='modal')
    if modal:
        body = modal.find('div', class_='modal-body')
        if body:
            st = body.find('table')
            if st:
                for tr in st.find_all('tr'):
                    th = tr.find('th'); td = tr.find('td')
                    if th and td:
                        lab = clean(th.get_text()).lower()
                        if 'youtube' in lab: youtube = grab_link(td)
                        elif 'dataset' in lab: dataset = grab_link(td)
                        elif 'contact' in lab: contact = grab_link(td)
                        elif 'description' in lab:
                            divs = td.find_all('div', class_='style-2')
                            description = clean(divs[1].get_text()) if len(divs) > 1 else clean(td.get_text())
                        elif 'department' in lab: department = clean(td.get_text())

    out.append({
        'S.No.': sno, 'Organization': org, 'Department': department,
        'Problem Statement Title': title, 'Category': category,
        'PS Number': ps_number, 'Submitted Idea(s) Count': ideas,
        'Theme': theme, 'Deadline for Idea Submission': deadline,
        'Description': description, 'youtube_link': youtube,
        'dataset_link': dataset, 'contact_link': contact
    })

with open('/home/mike/Desktop/wast/dayyan/sih_problem_statements.json', 'w', encoding='utf-8') as f:
    json.dump(out, f, indent=2, ensure_ascii=False)

n_y = sum(1 for d in out if d['youtube_link'])
n_d = sum(1 for d in out if d['dataset_link'])
n_c = sum(1 for d in out if d['contact_link'])
print(f'records={len(out)} youtube={n_y} dataset={n_d} contact={n_c}')
