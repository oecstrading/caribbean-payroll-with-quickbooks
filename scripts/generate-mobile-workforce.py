"""Build the 'Workforce on the Move' visual section and prepend it to the
current manual (v9 -> v10) and brochure (v5 -> v6). Requires reportlab, pypdf.
Describes verified behaviour only: roaming job sites, same-day site moves,
optional paid travel, phone clock and shared company tablets."""
from pathlib import Path
import subprocess
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from pypdf import PdfReader, PdfWriter

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'public/training'
IMG = ROOT / 'src/assets/mobile-workforce'
for n, p in [('B', 'DejaVu Sans'), ('BB', 'DejaVu Sans:bold')]:
    pdfmetrics.registerFont(TTFont(n, subprocess.check_output(['fc-match', '-f', '%{file}', p], text=True).strip()))
W, H = A4
TEAL, CORAL, SUN, INK, SEA, LEAF = [colors.HexColor(c) for c in ('#087F8C', '#D9564F', '#F2B134', '#233C41', '#E6F4F3', '#3E9B5B')]

def wrap(c, text, x, y, width, font='B', size=10, lead=14, color=INK):
    c.setFont(font, size); c.setFillColor(color)
    words, line = text.split(), ''
    for w in words:
        t = (line + ' ' + w).strip()
        if c.stringWidth(t, font, size) > width:
            c.drawString(x, y, line); y -= lead; line = w
        else:
            line = t
    if line: c.drawString(x, y, line); y -= lead
    return y

def photo(c, name, x, y, w, h):
    c.saveState(); p = c.beginPath(); p.roundRect(x, y, w, h, 14); c.clipPath(p, stroke=0)
    img = ImageReader(str(IMG / name)); iw, ih = img.getSize(); s = max(w / iw, h / ih)
    c.drawImage(img, x + (w - iw * s) / 2, y + (h - ih * s) / 2, iw * s, ih * s); c.restoreState()

def footer(c, edition, n):
    c.setFillColor(TEAL); c.rect(0, 0, W, 6, stroke=0, fill=1)
    c.setFillColor(CORAL); c.rect(W * .6, 0, W * .25, 6, stroke=0, fill=1)
    c.setFillColor(SUN); c.rect(W * .85, 0, W * .15, 6, stroke=0, fill=1)
    c.setFont('B', 8); c.setFillColor(INK); c.drawString(40, 18, f'OECS HR & Payroll | {edition} | Workforce on the Move')
    c.drawRightString(W - 40, 18, f'Move {n}')

def pill(c, x, y, text, bg):
    w = c.stringWidth(text, 'BB', 9) + 20
    c.setFillColor(bg); c.roundRect(x, y, w, 20, 10, stroke=0, fill=1)
    c.setFillColor(colors.white); c.setFont('BB', 9); c.drawString(x + 10, y + 6, text); return x + w + 6

def cover(c, edition):
    photo(c, 'construction.jpg', 0, H * .42, W, H * .58)
    c.setFillColor(colors.Color(0.03, 0.2, 0.23, alpha=.72)); c.rect(0, H * .42, W, 150, stroke=0, fill=1)
    c.setFillColor(colors.white); c.setFont('BB', 34); c.drawString(40, H * .42 + 95, 'Workforce on the Move')
    c.setFont('B', 13); c.drawString(40, H * .42 + 68, 'Clock in at any job site, on any phone or company tablet.')
    c.drawString(40, H * .42 + 48, 'Every punch syncs to one payroll.')
    y = H * .42 - 40
    x = pill(c, 40, y, 'CONSTRUCTION', CORAL); x = pill(c, x, y, 'LANDSCAPING', LEAF)
    x = pill(c, x, y, 'RADIO & TV', TEAL); pill(c, x, y, 'HOSPITALITY', SUN)
    y = wrap(c, 'Your people don’t sit at one desk. Crews build on Site 1 today and Site 2 tomorrow. Gardeners visit five properties before lunch. Camera crews chase the story across the island or overseas. OECS HR & Payroll follows them: workers punch wherever a clock is active and the platform collects every minute into a single timesheet that is ready for the AI Paymaster and your approval.', 40, y - 32, W - 80, size=11.5, lead=17)
    stats = [('Any site', 'roaming workers', TEAL), ('Same day', 'site-to-site moves', CORAL), ('Phone or tablet', 'one synced timesheet', SUN)]
    bw = (W - 80 - 20) / 3
    for i, (a, b, col) in enumerate(stats):
        x = 40 + i * (bw + 10)
        c.setFillColor(col); c.roundRect(x, 70, bw, 80, 12, stroke=0, fill=1)
        c.setFillColor(colors.white); c.setFont('BB', 15); c.drawCentredString(x + bw / 2, 118, a)
        c.setFont('B', 9.5); c.drawCentredString(x + bw / 2, 96, b)
    footer(c, edition, 1)

def journey(c, edition):
    c.setFillColor(SEA); c.rect(0, 0, W, H, stroke=0, fill=1)
    c.setFillColor(TEAL); c.setFont('BB', 24); c.drawString(40, H - 60, 'One worker. Three sites. One payday.')
    wrap(c, 'A typical day for a construction or landscaping crew member, set to “Any active job site”.', 40, H - 84, W - 80, size=11)
    steps = [('07:30', 'Clock in · Site 1', 'Phone checks location against the Site 1 boundary.', TEAL),
             ('11:45', 'Clock out · Site 1', 'Leaves for the next job.', CORAL),
             ('12:20', 'Clock in · Site 2', 'Uses the Site 2 tablet or their own phone.', TEAL),
             ('15:00', 'Clock out · Site 2', 'Moves on again the same day.', CORAL),
             ('15:30', 'Clock in · Site 3', 'Any active site is accepted.', TEAL),
             ('17:00', 'End of day', 'All punches land in one timesheet.', SUN)]
    top, gap = H - 140, 92
    c.setStrokeColor(TEAL); c.setLineWidth(4); c.line(95, top - 10, 95, top - gap * 5 - 10)
    for i, (t, h, d, col) in enumerate(steps):
        y = top - i * gap
        c.setFillColor(col); c.circle(95, y - 10, 15, stroke=0, fill=1)
        c.setFillColor(colors.white); c.setFont('BB', 11); c.drawCentredString(95, y - 14, str(i + 1))
        c.setFillColor(INK); c.setFont('BB', 11); c.drawRightString(72, y - 14, t)
        c.setFillColor(colors.white); c.roundRect(125, y - 42, W - 165, 62, 10, stroke=0, fill=1)
        c.setFillColor(col); c.setFont('BB', 13); c.drawString(140, y - 2, h)
        wrap(c, d, 140, y - 22, W - 200, size=10)
    y = 95
    c.setFillColor(INK); c.roundRect(40, 40, W - 80, y, 12, stroke=0, fill=1)
    c.setFillColor(SUN); c.setFont('BB', 12); c.drawString(56, y + 12, 'Travel between sites — your company decides')
    wrap(c, 'OFF (default): the gaps between clocking out at one site and in at the next are not paid.  ON: Attendance → Clock settings → “Pay travel time between job sites” pays first clock-in to last clock-out, with nothing deducted for travel.', 56, y - 8, W - 112, size=10, color=colors.white)
    footer(c, edition, 2)

def industries(c, edition):
    c.setFillColor(TEAL); c.setFont('BB', 24); c.drawString(40, H - 60, 'Built for companies that never stand still')
    rows = [('landscape.jpg', 'Landscapers & grounds crews', 'Visit hotels, villas and estates in one day. Each property can be a job site; crews punch on arrival and departure so clients and payroll see real time on each property.', LEAF),
            ('media.jpg', 'Radio & TV stations', 'Reporters, camera operators and engineers work in the studio, at outside broadcasts and on assignments. Studio staff use the shared tablet; field crews use their own phones. Same timesheet.', CORAL),
            ('construction.jpg', 'Construction & field services', 'Move crews between projects as work demands. Roaming workers may clock in at any active site, and each punch records where the work happened.', SUN)]
    y = H - 90
    for img, h, d, col in rows:
        ph = 205; y -= ph
        photo(c, img, 40, y, 230, ph)
        c.setFillColor(col); c.rect(285, y + ph - 34, 6, 30, stroke=0, fill=1)
        c.setFillColor(INK); c.setFont('BB', 14); c.drawString(300, y + ph - 26, h)
        wrap(c, d, 300, y + ph - 50, W - 340, size=10.5, lead=15)
        y -= 20
    wrap(c, 'Working in more than one island or abroad? Each company keeps its own sites, clocks and payroll rules, and administrators with multi-company access switch between them with one login.', 40, 50, W - 80, size=9.5, lead=13, color=TEAL)
    footer(c, edition, 3)

def devices(c, edition):
    c.setFillColor(TEAL); c.setFont('BB', 24); c.drawString(40, H - 60, 'Personal phone or company tablet')
    wrap(c, 'Staff choose what is convenient; the platform keeps one record.', 40, H - 84, W - 80, size=11)
    photo(c, 'tablet.jpg', 40, H - 375, W - 80, 270)
    cw = (W - 100) / 2; top = H - 395
    cards = [('MY PHONE', TEAL, ['Open the personal link, QR code or WhatsApp invite', 'Add the app to the home screen', 'Clock in, lunch out/in and end shift', 'Location checked at every punch', 'Offline punches queue and sync later for manager review', 'My dashboard: hours, days, late arrivals, estimated pay']),
             ('COMPANY TABLET', CORAL, ['Reception, kitchen, studio or site office', 'Activated by an admin with a 15-minute code', 'Many staff share one device', 'Selfie can be required per company', 'Hands-free voice option uses the name on file, with a selfie', 'Voice and offline punches always go to a manager'])]
    for i, (h, col, items) in enumerate(cards):
        x = 40 + i * (cw + 20)
        c.setFillColor(col); c.roundRect(x, 80, cw, top - 80, 14, stroke=0, fill=1)
        c.setFillColor(colors.white); c.setFont('BB', 14); c.drawString(x + 16, top - 30, h)
        y = top - 56
        for it in items:
            c.setFillColor(SUN); c.circle(x + 20, y + 3, 3.5, stroke=0, fill=1)
            y = wrap(c, it, x + 30, y, cw - 46, size=10, lead=14, color=colors.white) - 8
    wrap(c, 'Phones and tablets feed the same attendance record, so the AI Paymaster prepares payroll from every site and an administrator still approves before anything is saved or paid.', 40, 55, W - 80, size=9.5, lead=13, color=INK)
    footer(c, edition, 4)

def setup(c, edition):
    c.setFillColor(SEA); c.rect(0, 0, W, H, stroke=0, fill=1)
    c.setFillColor(TEAL); c.setFont('BB', 24); c.drawString(40, H - 60, 'Turn it on in four steps')
    steps = [('1', 'Add your job sites', 'Attendance: create each site with its location and boundary.', TEAL),
             ('2', 'Let workers roam', 'Employee folder → Login & clock → Required work site → “Any active job site (moves between sites)”. Save.', CORAL),
             ('3', 'Decide on travel time', 'Attendance → Clock settings → “Pay travel time between job sites”: on to pay it, off to leave gaps unpaid.', SUN),
             ('4', 'Hand out the clocks', 'Send personal links by WhatsApp, email or QR code, and activate a tablet at each site or department.', LEAF)]
    y = H - 110
    for n, h, d, col in steps:
        c.setFillColor(colors.white); c.roundRect(40, y - 110, W - 80, 110, 14, stroke=0, fill=1)
        c.setFillColor(col); c.roundRect(40, y - 110, 70, 110, 14, stroke=0, fill=1); c.rect(90, y - 110, 20, 110, stroke=0, fill=1)
        c.setFillColor(colors.white); c.setFont('BB', 34); c.drawCentredString(75, y - 67, n)
        c.setFillColor(INK); c.setFont('BB', 14); c.drawString(126, y - 32, h)
        wrap(c, d, 126, y - 54, W - 190, size=10.5, lead=15)
        y -= 130
    c.setFillColor(INK); c.roundRect(40, 50, W - 80, y - 60, 14, stroke=0, fill=1)
    c.setFillColor(SUN); c.setFont('BB', 13); c.drawString(58, y - 38, 'Good to know')
    for i, t in enumerate(['Workers with a fixed site keep the boundary rules of that site.',
                           'Punches outside any active site are refused, which helps stop buddy punching.',
                           'Timesheets already recorded are not changed when you switch travel pay on or off.',
                           'Approval by a person remains the only way payroll is saved.']):
        wrap(c, '•  ' + t, 58, y - 62 - i * 22, W - 116, size=10, color=colors.white)
    footer(c, edition, 5)

def build(base, out, edition, pages):
    tmp = Path('/tmp') / f'mw_{out}'
    c = canvas.Canvas(str(tmp), pagesize=A4); c.setTitle(f'OECS HR & Payroll — {edition}')
    for p in pages: p(c, edition); c.showPage()
    c.save()
    w = PdfWriter()
    base_r = PdfReader(str(DEST / base))
    w.add_page(base_r.pages[0])
    for pg in PdfReader(str(tmp)).pages: w.add_page(pg)
    for pg in base_r.pages[1:]: w.add_page(pg)
    w.add_metadata({'/Title': f'OECS HR & Payroll — {edition}'})
    with open(DEST / out, 'wb') as f: w.write(f)
    print(DEST / out, len(w.pages), 'pages')

if __name__ == '__main__':
    build('OECS_User_Manual_v9.pdf', 'OECS_User_Manual_v10.pdf', 'User Guide v10', [cover, journey, industries, devices, setup])
    build('OECS_Brochure_v5.pdf', 'OECS_Brochure_v6.pdf', 'Brochure v6', [cover, industries, devices])
