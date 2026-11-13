"""Prepend 'What's new - how to' pages (step-by-step tasks for recent features)
after the cover of the current manual (v11 -> v12) and brochure (v7 -> v8).
Text-only how-to pages that describe verified platform behaviour."""
import importlib.util
from pathlib import Path
from reportlab.lib import colors
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from pypdf import PdfReader, PdfWriter

spec = importlib.util.spec_from_file_location('mw', Path(__file__).with_name('generate-mobile-workforce.py'))
mw = importlib.util.module_from_spec(spec); spec.loader.exec_module(mw)
W, H, TEAL, CORAL, SUN, INK, SEA, LEAF = mw.W, mw.H, mw.TEAL, mw.CORAL, mw.SUN, mw.INK, mw.SEA, mw.LEAF
wrap = mw.wrap

TASKS = [
 ("Clocks & devices", TEAL, [
  ("Add a tablet or Windows PC clock", ["Menu > Clock devices > Add tablet clock.", "Name it, choose company and site, then send the link or 8-character code (valid 15 minutes).", "On the device, open the link or type the code and tap Activate."]),
  ("Install the Windows PC clock", ["Clock devices > Add Windows clock > One Click Installation (Edge or Chrome).", "Click Install in the address bar and tick 'Start automatically when I sign in'.", "Enter the activation code. The PC stays free for normal work."]),
  ("Set up clocks remotely for another country", ["Send the install link by WhatsApp or Email first.", "When the Pay Master is at the PC, add the clock and send its code. Do one company at a time."]),
  ("Move a clock to another company", ["Clock devices > Change company > choose company > Move clock.", "Then Resend link in the new company. Only clocks with no punches can move."]),
  ("Activate many clocks at once", ["Monitoring Center > Bulk activation. Tick one, several or all clocks or staff, across companies, then Issue codes."]),
 ]),
 ("Staff phone clocks", CORAL, [
  ("Reset, resend or remove a phone clock", ["Clock devices > Staff phone clocks.", "Send link: resend the clock link. Reset & resend: frees the old phone.", "Staff left: switches the clock off (reversible). Delete clock: removes it for good; history is kept."]),
  ("iPhone home-screen clock", ["Open the clock link in Safari with Private mode off.", "Share > Add to Home Screen. Always clock in from the Time Clock icon.", "New phone? After code + PIN, tap 'Yes, this is my phone'. More than 3 moves a week needs a manager Reset phone."]),
  ("No buddy punching", ["Each phone clocks for one employee only. Selfie is optional; voice-only tablet punches still need a selfie and manager review."]),
  ("Staff see hours, not pay", ["The staff clock shows worked hours only. Pay appears on the payslip."]),
 ]),
 ("Monitoring & attendance", SUN, [
  ("See clock and employee activity for any period", ["Monitoring Center > Clock & employee activity.", "Pick Today, Week, etc. or a From/To date-time, filter by employee or clock, and tap Show every punch."]),
  ("Ask the AI why something needs attention", ["Monitoring Center alerts > AI Paymaster explains. Confirm any suggested action yourself."]),
  ("Pay earned from hours", ["Attendance > All shifts shows Pay earned (hours x hourly rate). The dashboard shows Payroll earned today."]),
  ("Delete a punch selfie", ["Admins and Pay Masters: open the punch and choose Delete selfie."]),
 ]),
 ("Payroll tasks", LEAF, [
  ("Re-import past payrolls from payslips", ["Menu > Pay Slip Import. Upload one PDF with all payslips, review each employee, then approve.", "Payslip imports may save periods before the go-live date."]),
  ("Exempt staff from NIC or PAYE", ["Pay Slip Import > AI Paymaster: tick NIC or PAYE exempt per employee, or Exempt all employees."]),
  ("Estimate a future payroll", ["AI Paymaster > Payroll forecast. Pick the period, e.g. next semi-monthly. Estimate only; nothing is saved."]),
  ("Recurring allowances, deductions and loans", ["Deductions page: set frequency, Starts/Ends dates and amount.", "Use Stop / Restart to pause. Edit or delete with the row buttons; a loan already used in payroll can only be paused."]),
 ]),
 ("People & access", SEA, [
  ("Pay Master powers", ["Pay Masters can approve payroll imports, add employee folders, change AI reminders, manage Clock devices and delete employees."]),
  ("Remove an employee", ["Employees > open folder > Delete. Type DELETE to confirm. Payroll history is kept."]),
  ("Staff shown as platform users", ["User Management > red bin removes an old sign-in only. Their employee folder and clock stay."]),
  ("Home company", ["Signing in opens your home company; switching company stays until you sign out."]),
 ]),
]

def foot(c, ed, n):
    c.setFillColor(TEAL); c.rect(0, 0, W, 6, stroke=0, fill=1)
    c.setFillColor(CORAL); c.rect(W * .6, 0, W * .25, 6, stroke=0, fill=1)
    c.setFont('B', 8); c.setFillColor(INK); c.drawString(40, 18, f"OECS HR & Payroll | {ed} | What's new - how to")
    c.drawRightString(W - 40, 18, f'New {n}')

def intro(c, ed):
    c.setFillColor(TEAL); c.rect(0, H - 220, W, 220, stroke=0, fill=1)
    c.setFillColor(colors.white); c.setFont('BB', 30); c.drawString(40, H - 100, "What's new")
    c.setFont('B', 13); c.drawString(40, H - 130, 'Step-by-step tasks for the latest features')
    y = H - 270
    for i, (sec, col, tasks) in enumerate(TASKS):
        c.setFillColor(col); c.roundRect(40, y - 70, W - 80, 70, 12, stroke=0, fill=1)
        c.setFillColor(colors.white if col != SEA else INK); c.setFont('BB', 15); c.drawString(58, y - 30, sec)
        wrap(c, ' · '.join(t[0] for t in tasks), 58, y - 46, W - 120, size=8.5, lead=11, color=colors.white if col != SEA else INK)
        y -= 84
    foot(c, ed, 1)

def section(idx):
    sec, col, tasks = TASKS[idx]
    def page(c, ed):
        c.setFillColor(col); c.rect(0, H - 80, W, 80, stroke=0, fill=1)
        c.setFillColor(colors.white if col != SEA else INK); c.setFont('BB', 22); c.drawString(40, H - 50, sec)
        y = H - 115
        for title, steps in tasks:
            c.setFillColor(INK); c.setFont('BB', 13); c.drawString(40, y, title); y -= 20
            for k, s in enumerate(steps, 1):
                c.setFillColor(col); c.circle(48, y + 3.5, 7, stroke=0, fill=1)
                c.setFillColor(colors.white if col != SEA else INK); c.setFont('BB', 8); c.drawCentredString(48, y + 0.8, str(k))
                y = wrap(c, s, 62, y, W - 110, size=10.5, lead=14) - 6
            y -= 12
        foot(c, ed, idx + 2)
    return page

def build(base, out, ed, pages):
    tmp = Path('/tmp') / f'wn_{out}'
    c = canvas.Canvas(str(tmp), pagesize=A4)
    for p in pages: p(c, ed); c.showPage()
    c.save()
    w = PdfWriter(); b = PdfReader(str(mw.DEST / base))
    w.add_page(b.pages[0])
    for pg in PdfReader(str(tmp)).pages: w.add_page(pg)
    for pg in b.pages[1:]: w.add_page(pg)
    w.add_metadata({'/Title': f'OECS HR & Payroll - {ed}'})
    with open(mw.DEST / out, 'wb') as f: w.write(f)
    print(out, len(w.pages))

if __name__ == '__main__':
    pages = [intro] + [section(i) for i in range(len(TASKS))]
    build('OECS_User_Manual_v11.pdf', 'OECS_User_Manual_v12.pdf', 'User Guide v12', pages)
    build('OECS_Brochure_v7.pdf', 'OECS_Brochure_v8.pdf', 'Brochure v8', [intro])
