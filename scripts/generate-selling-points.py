"""Add 'Selling points' pages (accounting hand-off, security companies,
geofencing/geolocation, projects & crews) after the cover of the current
manual (v10 -> v11) and brochure (v6 -> v7). Reuses the Workforce on the Move
drawing helpers. Describes existing platform pages only."""
import importlib.util
from pathlib import Path
from reportlab.lib import colors
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from pypdf import PdfReader, PdfWriter

spec = importlib.util.spec_from_file_location('mw', Path(__file__).with_name('generate-mobile-workforce.py'))
mw = importlib.util.module_from_spec(spec); spec.loader.exec_module(mw)
W, H, TEAL, CORAL, SUN, INK, SEA, LEAF = mw.W, mw.H, mw.TEAL, mw.CORAL, mw.SUN, mw.INK, mw.SEA, mw.LEAF
wrap, photo, pill = mw.wrap, mw.photo, mw.pill

def foot(c, edition, n):
    c.setFillColor(TEAL); c.rect(0, 0, W, 6, stroke=0, fill=1)
    c.setFillColor(CORAL); c.rect(W * .6, 0, W * .25, 6, stroke=0, fill=1)
    c.setFillColor(SUN); c.rect(W * .85, 0, W * .15, 6, stroke=0, fill=1)
    c.setFont('B', 8); c.setFillColor(INK); c.drawString(40, 18, f'OECS HR & Payroll | {edition} | Why customers choose us')
    c.drawRightString(W - 40, 18, f'Edge {n}')

def bullets(c, items, x, y, width, color=INK, dot=TEAL, size=10.5):
    for it in items:
        c.setFillColor(dot); c.circle(x + 4, y + 3.5, 3.5, stroke=0, fill=1)
        y = wrap(c, it, x + 16, y, width - 16, size=size, lead=15, color=color) - 7
    return y

def hero(c, img, title, sub, tags):
    photo(c, img, 0, H * .55, W, H * .45)
    c.setFillColor(colors.Color(0.03, 0.2, 0.23, alpha=.75)); c.rect(0, H * .55, W, 110, stroke=0, fill=1)
    c.setFillColor(colors.white); c.setFont('BB', 26); c.drawString(40, H * .55 + 66, title)
    c.setFont('B', 12); c.drawString(40, H * .55 + 42, sub)
    x = 40
    for t, col in tags: x = pill(c, x, H * .55 + 12, t, col)

def accounting(c, ed):
    hero(c, 'accounting.jpg', 'Your books, your choice', 'Connect QuickBooks Online — or use our built-in payroll bookkeeping.',
         [('QUICKBOOKS', LEAF), ('BUILT-IN BOOKS', TEAL), ('ACCOUNTANT READY', CORAL)])
    top = H * .55 - 24; cw = (W - 100) / 2; ch = top - 140
    cards = [('Option A · QuickBooks Online', LEAF, [
                'Connect your existing QuickBooks company',
                'Map wages, PAYE, NIC, allowances and deductions to your own accounts',
                'Approved payroll posts as a journal entry automatically',
                'Every post is logged so nothing is sent twice']),
             ('Option B · Built-in bookkeeping', TEAL, [
                'Caribbean payroll chart of accounts set up for you',
                'Payroll Register, Statutory Remittance and departmental reports',
                'NIC, PAYE and payslip PDFs and CSV exports',
                'Hand the whole period to your Auditor or Accountant'])]
    for i, (h, col, items) in enumerate(cards):
        x = 40 + i * (cw + 20)
        c.setFillColor(col); c.roundRect(x, 140, cw, ch, 14, stroke=0, fill=1)
        c.setFillColor(colors.white); c.setFont('BB', 13); c.drawString(x + 14, top - 28, h)
        bullets(c, items, x + 14, top - 60, cw - 28, color=colors.white, dot=SUN, size=11.5)
    c.setFillColor(INK); c.roundRect(40, 40, W - 80, 85, 12, stroke=0, fill=1)
    c.setFillColor(SUN); c.setFont('BB', 12); c.drawString(56, 102, 'Approve once — the books follow')
    wrap(c, 'After a manager approves payroll, payslips are emailed and the journal goes to QuickBooks when connected. Without QuickBooks, reports and exports are ready for your accountant the same day.', 56, 84, W - 112, size=10, color=colors.white)
    foot(c, ed, 1)

def security(c, ed):
    hero(c, 'security.jpg', 'Built for security companies', 'Guards, posts, patrols and payroll in one platform.',
         [('GUARD TOURS', CORAL), ('ROSTERS', TEAL), ('CLIENT BILLING', SUN)])
    y = H * .55 - 30
    rows = [('Guard tours & incidents', 'Checkpoint patrols, incident reports with photos and voice notes, and a live command center map.', CORAL),
            ('Rosters & late alerts', 'Weekly post assignments, overtime checks and alerts for late or missed shifts.', TEAL),
            ('Compliance & hiring', 'Applicant tracking, licence and certificate expiry warnings, guard performance scores.', SUN),
            ('Bill clients from real hours', 'Invoices built from location-verified attendance, plus a client portal for patrol logs.', LEAF)]
    for h, d, col in rows:
        c.setFillColor(SEA); c.roundRect(40, y - 82, W - 80, 82, 12, stroke=0, fill=1)
        c.setFillColor(col); c.roundRect(40, y - 82, 10, 82, 5, stroke=0, fill=1)
        c.setFillColor(INK); c.setFont('BB', 13); c.drawString(64, y - 26, h)
        wrap(c, d, 64, y - 46, W - 130, size=10.5)
        y -= 94
    wrap(c, 'Hire-to-paid: recruit the guard, post them, prove they were there, bill the client and pay the guard — without spreadsheets.', 40, 50, W - 80, size=10, lead=14, color=TEAL)
    foot(c, ed, 2)

def geo(c, ed):
    c.setFillColor(SEA); c.rect(0, 0, W, H, stroke=0, fill=1)
    c.setFillColor(TEAL); c.setFont('BB', 24); c.drawString(40, H - 60, 'Geofencing & geolocation')
    wrap(c, 'Every clock-in and clock-out records where it happened. Punches outside an active site boundary are refused.', 40, H - 84, W - 80, size=11)
    cx, cy = W / 2, H - 290
    for r, a in [(150, .12), (110, .2), (70, .35)]:
        c.setFillColor(colors.Color(0.03, 0.5, 0.55, alpha=a)); c.circle(cx, cy, r, stroke=0, fill=1)
    c.setStrokeColor(TEAL); c.setLineWidth(2); c.setDash(6, 4); c.circle(cx, cy, 110, stroke=1, fill=0); c.setDash()
    c.setFillColor(TEAL); c.setFont('BB', 10); c.drawCentredString(cx, cy + 118, 'SITE BOUNDARY')
    for (dx, dy, ok) in [(-40, 20, True), (30, -35, True), (10, 50, True), (175, 60, False)]:
        c.setFillColor(LEAF if ok else CORAL); c.circle(cx + dx, cy + dy, 11, stroke=0, fill=1)
        c.setFillColor(colors.white); c.setFont('BB', 11); c.drawCentredString(cx + dx, cy + dy - 4, '✓' if ok else '✗')
    c.setFillColor(CORAL); c.setFont('BB', 10); c.drawCentredString(cx + 175, cy + 80, 'Refused')
    c.setFillColor(LEAF); c.drawCentredString(cx - 40, cy - 2, '')
    cw = (W - 100) / 3; y0 = 110; ch = 150
    cards = [('Stops buddy punching', 'Location, PIN and optional selfie must match the worker.', CORAL),
             ('Checked by the server', 'Distances are verified on our side, not trusted from the phone.', TEAL),
             ('Map link on every punch', 'Managers open the exact spot from the attendance list.', SUN)]
    for i, (h, d, col) in enumerate(cards):
        x = 40 + i * (cw + 10)
        c.setFillColor(col); c.roundRect(x, y0, cw, ch, 12, stroke=0, fill=1)
        yy = wrap(c, h, x + 12, y0 + ch - 26, cw - 24, font='BB', size=12, lead=15, color=colors.white)
        wrap(c, d, x + 12, yy - 8, cw - 24, size=10.5, lead=15, color=colors.white)
    wrap(c, 'Fixed-post guards stay tied to their site; roaming crews can punch at any active site. Offline and voice punches always go to a manager.', 40, 70, W - 80, size=10, lead=14, color=INK)
    foot(c, ed, 3)

def projects(c, ed):
    hero(c, 'crew.jpg', 'Projects & crew management', 'Know what every crew costs, on every project.',
         [('PROJECTS', SUN), ('CREWS', CORAL), ('PROFITABILITY', LEAF)])
    y = H * .55 - 34
    items = ['Projects with budgets, sites and assigned crews',
             'Crew rosters and daily site reports with photos',
             'Equipment logs and contractor payments',
             'Labour hours from the clock flow straight into project cost',
             'Project profitability: budget vs actual labour and contractor cost',
             'Approved payroll and project costs line up for your accountant']
    y = bullets(c, items, 40, y, W - 80, size=11.5) - 20
    flow = [('Clock in on site', TEAL), ('Hours to project', CORAL), ('Cost vs budget', SUN), ('Approve & post', LEAF)]
    bw = (W - 80 - 30) / 4
    for i, (t, col) in enumerate(flow):
        x = 40 + i * (bw + 10)
        c.setFillColor(col); c.roundRect(x, y - 70, bw, 70, 12, stroke=0, fill=1)
        c.setFillColor(colors.white); c.setFont('BB', 22); c.drawCentredString(x + bw / 2, y - 32, str(i + 1))
        c.setFont('BB', 10); c.drawCentredString(x + bw / 2, y - 54, t)
    c.setFillColor(INK); c.roundRect(40, 40, W - 80, 80, 12, stroke=0, fill=1)
    c.setFillColor(SUN); c.setFont('BB', 12); c.drawString(56, 98, 'Ideal for construction, landscaping and field services')
    wrap(c, 'Clock in on site, see the cost on the project, approve payroll and post the books — one platform.', 56, 78, W - 112, size=10, color=colors.white)
    foot(c, ed, 4)

def build(base, out, ed, pages):
    tmp = Path('/tmp') / f'sp_{out}'
    c = canvas.Canvas(str(tmp), pagesize=A4)
    for p in pages: p(c, ed); c.showPage()
    c.save()
    w = PdfWriter(); b = PdfReader(str(mw.DEST / base))
    w.add_page(b.pages[0])
    for pg in PdfReader(str(tmp)).pages: w.add_page(pg)
    for pg in b.pages[1:]: w.add_page(pg)
    w.add_metadata({'/Title': f'OECS HR & Payroll — {ed}'})
    with open(mw.DEST / out, 'wb') as f: w.write(f)
    print(out, len(w.pages))

if __name__ == '__main__':
    allp = [accounting, security, geo, projects]
    build('OECS_User_Manual_v10.pdf', 'OECS_User_Manual_v11.pdf', 'User Guide v11', allp)
    build('OECS_Brochure_v6.pdf', 'OECS_Brochure_v7.pdf', 'Brochure v7', allp)
