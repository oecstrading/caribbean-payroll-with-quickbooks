"""Author current public payroll guide and brochure. Requires reportlab."""
from pathlib import Path
from datetime import datetime, timezone
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Image
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import subprocess

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'public/training'
DEST.mkdir(parents=True, exist_ok=True)
for name, pattern in [('Body', 'DejaVu Sans'), ('BodyBold', 'DejaVu Sans:bold')]:
    pdfmetrics.registerFont(TTFont(name, subprocess.check_output(['fc-match', '-f', '%{file}', pattern], text=True).strip()))
pdfmetrics.registerFontFamily('Body', normal='Body', bold='BodyBold', italic='Body', boldItalic='BodyBold')
TEAL, INK, CORAL = '#087F8C', '#233C41', '#D9564F'
styles = getSampleStyleSheet()
for name in styles.byName:
    styles[name].fontName = 'Body'
    styles[name].textColor = colors.HexColor(INK)
styles['Normal'].fontSize = 10
styles['Normal'].leading = 15
styles['Normal'].spaceAfter = 10
styles['Title'].fontName = 'BodyBold'
styles['Title'].fontSize = 27
styles['Title'].leading = 34
styles['Title'].textColor = colors.HexColor(TEAL)
styles['Heading1'].fontName = 'BodyBold'
styles['Heading1'].fontSize = 20
styles['Heading1'].leading = 26
styles['Heading1'].spaceAfter = 15
styles['Heading1'].textColor = colors.HexColor(TEAL)
styles['Heading2'].fontName = 'BodyBold'
styles['Heading2'].fontSize = 12
styles['Heading2'].leading = 18
styles['Heading2'].textColor = colors.HexColor(CORAL)
styles.add(ParagraphStyle('SmallNote', parent=styles['Normal'], fontSize=8, leading=12))
DATE = datetime.now(timezone.utc).strftime('%d %B %Y')
PUBLIC = 'https://caribbean-payroll-with-quickbooks.lovable.app/training-public'

def build(filename, edition, pages):
    story = []
    for i, (title, blocks) in enumerate(pages):
        if i: story.append(PageBreak())
        story.append(Paragraph(title, styles['Title'] if i == 0 else styles['Heading1']))
        if i == 0:
            story.append(Spacer(1, 14))
            story.append(Image(str(ROOT / 'src/assets/caribbean-hero.jpg'), width=499, height=280, kind='proportional'))
            story.append(Spacer(1, 18))
        for heading, text in blocks:
            if heading: story.append(Paragraph(heading, styles['Heading2']))
            story.append(Paragraph(text, styles['Normal']))
    def footer(canvas, doc):
        canvas.setStrokeColor(colors.HexColor(TEAL)); canvas.line(48, 42, A4[0]-48, 42)
        canvas.setFont('Body', 8); canvas.setFillColor(colors.HexColor(INK))
        canvas.drawString(48, 27, f'OECS HR & Payroll | {edition} | {DATE}')
        canvas.drawRightString(A4[0]-48, 27, str(doc.page))
    path = DEST / filename
    SimpleDocTemplate(str(path), pagesize=A4, leftMargin=48, rightMargin=48, topMargin=40, bottomMargin=56, title=f'OECS HR & Payroll — {edition}', author='OECS HR & Payroll').build(story, onFirstPage=footer, onLaterPages=footer)
    print(path)

GUIDE = [
('OECS HR & Payroll', [('', 'User Guide v6 · Client demonstration and payroll workflow'), ('Prepare → Review → Approve → Report', 'Employee login and clocks, AI Paymaster preparation, human approval, reports and the accounting handoff. Includes a complete isolated client demonstration.'), ('Caribbean operations, human control', 'The client demo uses fictional Demo Employee and Human in the Middle Administrator in Saint Lucia. Demo PIN access is role simulation, not a real account. AI cannot approve payroll or transfer money.')]),
('1. Prepare the people and records', [
('Sign in and confirm access', 'Use email/password, configured Google sign-in or an administrator-assigned PIN with your email. Keep your PIN private. Payroll managers can manage operational payroll and edit employee folders; account creation and deletion remain administrator-controlled.'),
('Set up each employee folder', 'Open Employees → Live employees. Administrators can add employees without an email; this creates an employment record, not a login account. Managers edit existing folders. Complete Personal, Employment, Payroll and Emergency details; save, reopen and check the values.'),
('Login and clock in one place', 'Open Employees → employee folder → Login &amp; clock. An authorized administrator can configure login email, username/PIN, invitation/password reset and clock settings. Employees choose passwords through the email link; existing passwords are never displayed. Set permitted clock methods, schedule and assigned site. Real punches require device location and server validation; the demo uses a labelled fictional location.'),
('Pick or enter HR details', 'Use searchable dropdowns for department, job title, reporting manager, location, city, nationality and schedule. You can enter your own values. Confirm department membership before choosing a payroll group.'),
('Keep HR files private', 'In Documents, upload contracts, certifications or other HR files; choose an expiry date and whether the employee may see the file. HR manages files. Staff see only their own explicitly shared files. Downloads use temporary links. Employee files do not belong in the public Training Hub.'),
('Before payroll', 'Review start/end dates, employment status, statutory IDs, bank details, deductions and additions. Expiry tracking helps identify renewals but does not certify legal compliance. Review actual attendance separately; simulated clock punches never feed live payroll.')]),
('2. Set the rate and working hours', [
('Pay basis is separate from payroll period', 'In the employee’s Payroll tab choose Monthly, Semi-monthly, Weekly, Daily or Hourly and enter the matching rate. Payroll saves a monthly-equivalent salary. The Run Payroll period then determines the share of that saved salary paid.'),
('Weekly hours—not a fixed 9-to-5', 'Enter Standard daily hours and Hours per work week. Monthly hours = weekly hours × 52 ÷ 12. For example, 36 hours/week gives 156 hours/month; 40 hours/week gives approximately 173.33 hours/month.'),
('Hourly example', 'At XCD 10/hour and 36 hours/week, monthly-equivalent pay is XCD 1,560. A weekly run pays approximately XCD 360 before deductions. These are contractual estimates, not a count of actual clocked hours.'),
('Daily example', 'At XCD 80/day, 36 hours/week and 6 hours/day, the schedule implies 6 days/week: 80 × 6 × 52 ÷ 12 = XCD 2,080/month. If weekly hours are blank, conversion assumes five days/week using the daily hours.'),
('Other bases and important limits', 'Monthly rate is unchanged; semi-monthly rate × 2; weekly rate × 52 ÷ 12. Save the folder to update payroll. Contractual salary uses monthly equivalents; attendance-based hourly/daily payroll is opt-in and revalidates approved hours and rates. Simulated attendance never enters live pay. Review overtime and unusual schedules manually.')]),
('3. Choose who and when to pay', [
('Open Run Payroll', 'Choose Live employees, the jurisdiction and one, two or any number of departments. Sample company is a separate fictional preview and never saves live payroll.'),
('Monthly / Semi-monthly', 'Monthly covers a complete calendar month. Semi-monthly covers the 1st–15th or the 16th–month end and pays half the monthly salary.'),
('Weekly', 'Choose Week starting. The end date is six days later. Salary is prorated by 12 ÷ 52 of the saved monthly equivalent.'),
('Custom dates / final pay', 'Choose From and To, then tick only the employees to pay. Add a reason such as “Final pay — dismissal”. Custom pay counts Monday–Friday at monthly salary × 12 ÷ 260 per working day. XCD 2,600/month over eight weekdays gives XCD 960 basic pay.'),
('Deductions and additions', 'The NIC ceiling and PAYE thresholds are scaled by the period factor. Monthly recurring creditor deductions are prorated. One-off additions assigned to the start month are included in full: check that a bonus is not reused in another run. Holidays are not excluded from custom weekday counting. Severance, notice pay, accrued leave and local statutory treatment need manual professional review.')]),
('4. Review with the AI Payroll Officer', [
('AI Paymaster: prepare and remind', 'Open Menu → AI Paymaster. Daily scheduled and on-demand checks prepare company-isolated drafts, unusual-change flags, missing-punch suggestions, reminders and cost forecasts. Review flagged shifts and confirm corrections rather than accepting invented punches. Paymaster does not approve or pay; open Run Payroll to verify and approve the actual run. The client demo uses a scripted illustration, not a live AI request.'),
('Review & Sync → Audit', 'Compare every employee’s basic pay, additions, gross, NIC, PAYE, creditor deductions and net. Continue to Audit. The existing warning checks the configured minimum wage, not every payroll or legal obligation.'),
('Request the AI review', 'Select Review this payroll. The officer receives anonymous Employee N / Department N references, draft amounts and missing-ID/minimum-wage flags—not names, email, NIC/TAN values, bank details or private documents. It returns a draft summary, issues to check and next steps.'),
('Act on exceptions', 'Match Employee N to the same row position in Employee Payroll Preview. Verify zero pay, deductions, missing statutory identifiers and any discrepancy. Edit employee details, additions or deductions in the appropriate page; return and review the refreshed draft. Changing period, departments or draft amounts discards the old AI review.'),
('Human control remains essential', 'The officer has no access to saved run history, attendance, private HR documents or QuickBooks records. It cannot verify current laws, approve, save, edit figures or pay staff. Verify recommendations; an AI review is not a compliance certificate.'),
('If AI is unavailable', 'No payroll is changed. Read the displayed error, review manually, and request a new review later if needed. No automatic replay of a failed AI request is performed. This is a contextual payroll reviewer, not an ongoing chat or autonomous payroll operator.')]),
('5. Approve, check reports and arrange payment', [
('Continue to Approve', 'Review the summary, department count, employee count, gross pay, employee/employer NIC, PAYE and total net pay. Only a manager or administrator can Approve & Save Payroll. AI does not perform this action.'),
('Read the saved result', 'A successful live approval saves the run and employee payslips together. The server rejects overlapping paid dates per employee; an overlap is checked at approval, not by AI. If approval fails, read the message and correct the draft—do not assume staff were paid.'),
('Departmental and consolidated reports', 'Open Reports or Payroll History and select the saved period. Compare Departmental with Consolidated totals; export PDF or CSV and retain the payroll record. Saved names and departments reflect the approved run rather than later folder changes.'),
('Payslips and actual payment', 'Use saved employee payslips for delivery where supported. Sample payslips do not send mail. A saved payroll run is not a bank transfer: arrange wage payment separately and verify receipt. Check account-free employee delivery options manually.'),
('QuickBooks handoff', 'Payroll Settings pairs earnings, NIC/PAYE liabilities, deductions, assets and bank accounts with QuickBooks accounts. Review Auto-map proposals; placeholders are not live accounts. QuickBooks Sync remains a simulation until production credentials and OAuth are configured. Verify production posting separately; no live journal or payment is promised.')]),
('6. Training, operations and proven patterns', [
('Current resources', f'Both Training Hubs include the latest v6 guide and retained v4 brochure. Download or share them from <link href="{PUBLIC}">{PUBLIC}</link>. Open Client payroll demo for the isolated walkthrough. Published links show the new revision only after the app is republished. Earlier uploaded documents are retained; never upload confidential employee data to public training.'),
('Hire-to-paid operations', 'Applicant Tracking supports recruitment; Compliance tracks licenses and expiry; rosters, sites, geofencing, guard tours, incident reports and invoicing support field operations. Verify attendance, alerts, voice processing and billing with real permissions before relying on automation. Device and simulated clocks remain separate; reset simulation for training only.'),
('Examples from existing platforms', 'The workflow follows familiar patterns: Gusto’s Gus provides payroll/HR guidance with verification cautions; Rippling describes AI exception detection and approval before action; ADP describes anomaly detection and guided payroll resolution. These are examples, not connections or endorsements. Their capabilities are not automatically present in this app.'),
('Official references · checked 20 October 2026', '<link href="https://support.gusto.com/article/250211164235690/use-gus-gustos-ai-assistant">Gusto: Use Gus, Gusto’s AI assistant</link><br/><link href="https://www.rippling.com/platform/ai">Rippling: AI for HR, payroll and IT</link><br/><link href="https://www.adp.com/what-we-offer/products/adp-workforce-now/payroll.aspx">ADP Workforce Now: Payroll</link>'),
('Go-live checklist', 'Confirm employees and rates; validate local taxes and final-pay entitlements; review actual worked time; request and check AI advice; approve a real run; read saved reports/payslips; confirm wage payment and delivery separately. Current configured jurisdictions are Saint Lucia, Antigua and Barbuda, Saint Kitts and Nevis, Dominica and Grenada. Other islands require added, validated configurations—not automatic legal coverage.')]),
('7. Client demo: employee PIN to AI draft', [
('Open the isolated demonstration', 'From either Training Hub choose Open client payroll demo, or visit <link href="https://caribbean-payroll-with-quickbooks.lovable.app/payroll-demo">/payroll-demo</link> after publication. This public demonstration never creates live employees or login accounts, touches real payroll, calls AI, sends email or posts to QuickBooks. Restart resets the local walkthrough; refreshing also resets it.'),
('1 / Demo Employee PIN login', 'Enter username demo.employee and demo PIN 135790. These are public fictional demo values, not production credentials. The employee workspace contains the clock step; administrator approval is a separate role simulation.'),
('2 / Capture attendance', 'Choose Clock in — 08:00, then Clock out — 16:00. The fixed demonstration date is 26 October 2026 (AST); location is simulated Castries. Eight hours at XCD 25/hour gives XCD 200. No GPS reading or real punch is created.'),
('3 / Prepare with AI Paymaster', 'Open AI Paymaster and select Prepare demo payroll. The scripted review displays paired punches, a bank-details exception, a reminder for human review and a cost forecast. Employee NIC at a fictional 5% is XCD 10; demo PAYE is zero; loan deduction is XCD 20. Net is 200 − 10 − 0 − 20 = XCD 170. Employer NIC is XCD 10; total employer cost is XCD 210. These are illustration assumptions, not validated statutory calculations.'),
('4 / Human in the Middle Administrator', 'Open human review. Enter username demo.administrator and demo PIN 246802. Check the review confirmation after examining attendance, rates, bank details and the loan. Select Approve demo payroll. AI cannot click this approval. The fictional loan balance falls from XCD 100 to XCD 80. No wages are paid.')]),
('8. Client demo: reports to external accountant', [
('5 / Generate the complete demo report set', 'After approval open Reports. Download PDF or CSV for Attendance, Payroll summary, Departmental payroll, Consolidated payroll, Salary slip, NIC and PAYE worksheet, and QuickBooks journal. With one fictional employee the departmental and consolidated employee totals match. Every PDF is labelled SIMULATION; the statutory worksheet is not a submission-ready NIC C3, PAYE or TD5 form.'),
('6 / Simulate a balanced QuickBooks post', 'Open QuickBooks &amp; email. Review debits of XCD 200 wages expense and XCD 10 employer NIC expense. Credits are XCD 170 wages payable, XCD 20 NIC payable and XCD 20 employee loan receivable. Both sides total XCD 210. Select Simulate QuickBooks post. This creates no live account, journal or payment; the loan credit illustrates reducing a receivable, not creditor remittance.'),
('7 / Preview accountant email and salary slip delivery', 'Review the fictional external.accountant@example.invalid recipient and demo.employee@example.invalid salary-slip copy. The preview lists seven PDF attachments and the payroll reconciliation. Select Simulate email delivery. The completed status is a local demonstration only: no SMTP/API request or mail attachment is sent. No real accountant address is needed.'),
('Before replacing simulation with customer production', 'Use real employee login setup, verified company permissions and live clock validation. Confirm statutory rules, rates, loan balances and bank details. Human approval remains mandatory. Configure and independently test QuickBooks production authorization/posting; verify actual employee and accountant email delivery with consent. Demo completion does not establish these services are operational, nor guarantee uptime or legal compliance.')]),
]
BROCHURE = [
('OECS HR & Payroll', [('', 'Brochure / Flyer v4 · Caribbean workforce management'), ('From employee folder to approved payroll', 'Prepare HR records. Choose pay rates and hours. Run payroll for your dates and departments. Ask the AI Payroll Officer to review the draft, then approve with confidence and retain clear reports.'), ('Flexible for your workforce', 'Monthly • Semi-monthly • Weekly • Custom final-pay dates<br/>Hourly and daily rates • Weekly hours • Departmental and consolidated reports')]),
('Your payroll manager’s workflow', [
('01 / Prepare', 'Maintain employee folders, even without email. Select departments, job titles and schedules; add your own entries. Store contracts and certifications privately with expiry dates and controlled sharing.'),
('02 / Calculate', 'Choose the employee’s rate and weekly hours. Hourly pay uses the saved monthly equivalent—not a fixed 9-to-5. Example: XCD 10/hour × 36 hours/week = XCD 1,560/month, or approximately XCD 360 for a weekly run before deductions.'),
('03 / Select the run', 'Pay one department, two or many. Choose monthly, semi-monthly, weekly or custom dates and specific staff for final pay. Review prorated salary and deductions; manually check one-off additions and final-pay entitlements.'),
('04 / Ask the AI Payroll Officer', 'Request a read-only review of anonymous draft amounts and flags. Get a summary, issues to investigate and next steps. Inspired by payroll assistance and review patterns in Gusto, Rippling and ADP—not integrations with those products.'),
('05 / Approve and report', 'The manager approves; the server saves live payroll and payslips together and rejects overlapping paid dates. Export department and consolidated reports. Payment, payslip delivery and statutory filing are separate tasks to verify.'),
('06 / Prepare the accounting handoff', 'Map payroll earnings, NIC/PAYE liabilities and deductions to QuickBooks accounts. QuickBooks scaffolding includes mapping and simulated sync; production authorization and posting still require setup and verification.')]),
('Caribbean HR, with practical safeguards', [
('A joined-up operational platform', 'Recruit applicants, track compliance expiry, organize rosters and sites, review attendance, record patrols and incidents, and prepare client invoices. Voice input and command navigation support field work where device and service permissions allow.'),
('Multi-island configuration', 'Current payroll configurations cover Saint Lucia, Antigua and Barbuda, Saint Kitts and Nevis, Dominica and Grenada. The system can be extended for other islands with validated local rates and rules. Do not assume every Caribbean jurisdiction is already configured or certified.'),
('AI assists. People decide.', 'AI does not change wages, approve runs, transfer money or certify statutory compliance. Payroll uses contractual monthly-equivalent estimates rather than actual attendance hours. Check overtime, holidays, severance and unusual schedules manually.'),
('Practice without touching live payroll', 'Fictional Smiley’s Tinting Services samples and the resettable simulated attendance clock support training. They stay separate from live attendance, payroll, billing and employee accounts.'),
('Share the guide and train your team', f'<link href="{PUBLIC}">{PUBLIC}</link><br/>Latest resources become available on the published site after republishing. Managers can upload company training documents. Keep confidential employee records in private folders.'),
('Workflow references', '<link href="https://support.gusto.com/article/250211164235690/use-gus-gustos-ai-assistant">Gusto Gus</link> · <link href="https://www.rippling.com/platform/ai">Rippling AI</link> · <link href="https://www.adp.com/what-we-offer/products/adp-workforce-now/payroll.aspx">ADP Payroll</link><br/>Public examples checked 20 October 2026; no affiliation or integration implied.')]),
]
if __name__ == '__main__':
    build('OECS_User_Manual_v6.pdf', 'User Guide v6', GUIDE)
