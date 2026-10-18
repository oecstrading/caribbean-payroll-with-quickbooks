"""Generate the publicly served manual. Requires reportlab."""
from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Image

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public/training/OECS_User_Manual_v4.pdf"
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
styles = getSampleStyleSheet()
styles["Title"].textColor = colors.HexColor("#087F8C")
styles["Heading1"].textColor = colors.HexColor("#087F8C")
styles["Normal"].fontSize = 11
styles["Normal"].leading = 17
story = []

def para(text, style="Normal"):
    story.extend([Paragraph(text, styles[style]), Spacer(1, 12)])

def section(title, paragraphs):
    para(title, "Heading1")
    for text in paragraphs:
        para(text)

def footer(canvas, doc):
    canvas.setFont("Helvetica", 9)
    canvas.setFillColor(colors.HexColor("#52656A"))
    canvas.drawString(48, 28, "OECS HR & Payroll | User Manual v4 | 18 October 2026")
    canvas.drawRightString(A4[0]-48, 28, str(doc.page))

para("OECS HR & Payroll", "Title")
para("User Manual / Version 4", "Heading1")
story.append(Image(str(ROOT / "src/assets/caribbean-hero.jpg"), width=480, height=270, kind="proportional"))
story.append(Spacer(1, 24))
para("Caribbean workforce operations, payroll and QuickBooks account mapping.")
para("Includes the Smiley's Tinting Services demonstration, Saint Lucia.")
para("Important: this edition distinguishes sample previews from live payroll. QuickBooks currently operates in simulated sandbox mode. Account creation and connected-service verification require a healthy account service.")
story.append(PageBreak())
section("1. Sign-in and access", [
    "Open /auth and sign in using your email and password, or use Google. PIN sign-in requires an administrator-assigned PIN and your email. Keep credentials private.",
    "Requested Payroll identity: display name Payroll; username Tintmyride758; invitation email info@smileysincslu.com. The username is a display handle, not an email sign-in credential.",
    "Requested access: all operational functions except creating and deleting users. This account and its restricted access are pending provisioning; do not assume an invitation was sent. Existing roles are Administrator, Manager and Employee. Only administrators currently open User Management.",
    "Use the navigation menu for Employees, Attendance, Run Payroll, Payslips, Payroll History, Reports, Settings, Training Hub and QuickBooks. Employees use the self-service portal for their own records."
])
section("2. Smiley's Tinting Services sample", [
    "The Employees, Attendance, Run Payroll and Payslips sample lists now include six fictional tinting-company staff: office coordinator, lead installer, technician, window film specialist, bookings assistant and trainee.",
    "The company is labeled Smiley's Tinting Services (Sample). Salaries, names and NIC/TAN identifiers are fictional examples in XCD; example.invalid email addresses cannot receive mail. Existing company details and earlier samples are not replaced.",
    "Search Employees by name or use department filters. Select a row to inspect a salary calculation, then View Payslip. These samples are not real employee accounts, employment records or approved payroll."
])
story.append(PageBreak())
section("3. Payroll and payslips", [
    "Run Payroll currently previews sample staff for March 2026. Review basic pay, additions, gross pay, NIC, PAYE, creditor deductions and net pay. Continue to Audit to review minimum-wage checks, then continue to the summary.",
    "Complete Sample Payroll marks the preview complete without saving a live payroll run, paying staff or inserting payslips. Email delivery is disabled for this sample list. Sample identities must never be substituted for real account IDs.",
    "Net pay is earnings including approved additions minus statutory and other deductions. Validate all current Saint Lucia tax rates and ceilings with your payroll adviser before a live run; configured examples are not tax advice.",
    "Payslips displays sample calculations and export options. Payroll History reads saved runs; empty history is expected when only sample previews exist. Digital payslip delivery requires real employee accounts and a working email service."
])
section("4. QuickBooks Online mapping", [
    "Open Payroll Settings to pair payroll items with QuickBooks accounts. Categories include earnings and premium pay, statutory and benefits liabilities, and assets and bank accounts. Review salary, overtime, bonus, NIC, PAYE, advances and any jurisdiction-specific levy with your accountant.",
    "Refresh reloads the catalogue. Auto-map proposes matches by account name; review each match. Create missing accounts currently creates local placeholder catalogue entries, not accounts in your live QuickBooks company.",
    "QuickBooks Sync provides Connection, COA Mapping, Sync Runs and Log views. Current sandbox connection and journal pushes are simulations. Production requires Intuit credentials and a completed OAuth connection; no live QuickBooks posting is verified."
])
story.append(PageBreak())
section("5. Attendance, projects and field work", [
    "Attendance includes sample clock-in/out records. CSV imports in the attendance screen are temporary in-memory records. A complete sample shift includes an unpaid meal break; displayed hours are not necessarily the full elapsed time.",
    "For live field operations, configure a site and geofence, assign a roster, and use GPS clock-in/out. Location permission and a working account service are required. Review late or missing punches before billing or payroll.",
    "Projects, crews, equipment and contractors organize field work such as automotive tint installation and residential window-film jobs. Sample employee lists do not automatically create project assignments or live time punches.",
    "Security-specific modules include Guard Tours, post checkpoints, incident reports, licensing compliance and emergency alerts. They are optional operational workflows for a tinting business, not evidence that tinting staff hold security licenses."
])
section("6. Voice, reports and billing", [
    "Use microphone controls where available for dictation in Guard Tour and Daily Reports. The app-wide voice control can request navigation and supported actions. Grant microphone permission, speak clearly and review all generated text before submitting.",
    "Voice interpretation depends on connected processing services and network access. Use typed input if recording or transcription fails. Do not rely on voice control for emergency response without verifying delivery.",
    "Review daily reports, incident records and client invoices before approval. Confirm the client, verified worked time, rate, taxes and supporting patrol records. Exact-minute billing and automatic report-to-invoice workflows require live end-to-end validation; this demonstration does not certify their operation."
])
story.append(PageBreak())
section("7. Training Hub and public sharing", [
    "Open Training Hub to search and filter documents by category. Administrators and managers can Upload Document: enter a title, description and category, choose the file and submit. Confirm the document appears before sharing it.",
    "Seed Defaults adds the original text-based flyer and manual outline; it is not the latest visual PDF. The current public PDF manual is available from /training-public and directly at /training/OECS_User_Manual_v4.pdf.",
    "The public Training Hub also resolves through /user-guide, /payroll-user-guide, /guide and /manual. Download opens a PDF; Share uses device sharing or copies an absolute URL. Public documents must not contain private employee or payroll information."
])
section("8. Go-live checklist and known limits", [
    "1. Confirm the account invitation is received and Payroll can sign in. Verify that creating and deleting users are denied by the server, not only hidden in the menu.",
    "2. Replace fictional examples with validated real employee records. Confirm company identifiers, bank details, salary, tax rates, NIC/TAN and working-hour rules with the employer and accountant.",
    "3. Verify a real payroll run, saved payslip read-back, PDF export and email delivery. Test permissions for each role, then complete production QuickBooks authorization and compare journal totals with saved payroll.",
    "4. Test attendance, compliance, report approval, billing and voice with real inputs and permissions. Account-service downtime currently prevents provisioning and authenticated checks; these workflows must not be described as flawlessly verified.",
    "5. Publish the updated application when ready; preview changes do not automatically update the published site. Keep this guide with your operating procedures."
])
SimpleDocTemplate(str(OUTPUT), pagesize=A4, rightMargin=48, leftMargin=48, topMargin=44, bottomMargin=48, title="OECS HR & Payroll - User Manual v4", author="OECS HR & Payroll").build(story, onFirstPage=footer, onLaterPages=footer)
print(OUTPUT)