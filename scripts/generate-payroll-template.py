"""Generate the customer onboarding template served from public/templates.

The Employees sheet carries every field the platform's employee folder stores, the Payroll
sheet uses the column names src/lib/salary-sheet.ts detects, and the remaining sheets feed
allowances, deductions, loans and QuickBooks account codes. Run:
    python scripts/generate-payroll-template.py
"""
from openpyxl import Workbook
from openpyxl.comments import Comment
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.worksheet.datavalidation import DataValidation

OUT = "public/templates/Payroll_Onboarding_Template_v2.xlsx"
FONT = "Arial"
SEA, SAND, CORAL = "0E7C86", "FFF4DC", "FF6F59"
head = Font(name=FONT, bold=True, color="FFFFFF")
body = Font(name=FONT)
blue = Font(name=FONT, color="0000FF")
thin = Side(style="thin", color="BBBBBB")
box = Border(left=thin, right=thin, top=thin, bottom=thin)
MONEY = '#,##0.00;(#,##0.00);"-"'

wb = Workbook()

# 1. Instructions -------------------------------------------------------------
ins = wb.active
ins.title = "Instructions"
lines = [
    ("Payroll onboarding template", True),
    ("Fill in the blue cells. Black cells are worked out for you. Then upload this file under Menu → Payroll Import.", False),
    ("", False),
    ("1. Company: your business details, country, pay cycle and the pay rules you use.", False),
    ("2. Employees: one row per person with everything their folder needs — contact, HR, pay basis and bank details.", False),
    ("   - Leave a cell blank when it does not apply. Dates are YYYY-MM-DD.", False),
    ("   - Pay frequency: Monthly, Semi-monthly, Weekly, Daily or Hourly. Enter the rate for that basis.", False),
    ("   - Weekly hours drives daily and hourly pay (for example 40, 36 or 44).", False),
    ("3. Payroll: this month's pay for each person — absences, overtime tiers, allowances, NIC, PAYE and deductions.", False),
    ("   - Days not worked: enter as a minus number (e.g. -2) so the days are deducted.", False),
    ("   - Tax method: 'Calculated' lets the platform work out PAYE; 'Fixed amount' keeps the PAYE you enter.", False),
    ("4. Allowances & Deductions: amounts paid or taken every month (travel, phone, insurance, union, creditors).", False),
    ("5. Loans & Balances: staff loans or advances still owed, with the monthly repayment.", False),
    ("6. Accounts: the accounting code for each payroll item (used for QuickBooks).", False),
    ("7. Departments: your department list with its cost centre and accounting codes.", False),
    ("", False),
    ("The example rows use fictional people. Replace or delete them before uploading.", False),
    ("For security, sign-in passwords and clock PINs are never entered here — they are set inside the app.", False),
    ("Nothing is saved until an administrator reviews the import and approves it.", False),
]
for i, (text, bold) in enumerate(lines, 1):
    ins.cell(i, 1, text).font = Font(name=FONT, bold=bold, size=14 if bold else 11, color=SEA if bold else "000000")
ins.column_dimensions["A"].width = 118

# 2. Company -----------------------------------------------------------------
co = wb.create_sheet("Company")
co["A1"], co["B1"] = "Setting", "Value"
settings = [
    ("Company name", "Example Company Ltd"),
    ("Country", "Saint Lucia"),
    ("Employer NIC number", "EMP-0001"),
    ("Tax ID", ""),
    ("VAT number", ""),
    ("Telephone", "+1 758 000 0000"),
    ("Website", "https://example.com"),
    ("Address", "Example Street, Castries"),
    ("Pay frequency", "Monthly"),
    ("Pay day", "Last working day of the month"),
    ("Overtime multiplier", 1.5),
    ("Double-time multiplier", 2),
    ("Hours per working day", 8),
    ("Working days in month", 22),
    ("Default weekly hours", 40),
    ("Employee NIC rate", 0.05),
    ("Employer NIC rate", 0.05),
    ("NIC monthly maximum", 250),
    ("NIC worked out on", "Total pay"),
    ("PAYE method", "Calculated"),
    ("Sync with QuickBooks", "No"),
]
ROW = {k: i + 2 for i, (k, _) in enumerate(settings)}
for r, (k, v) in enumerate(settings, 2):
    co.cell(r, 1, k).font = body
    c = co.cell(r, 2, v)
    c.font = blue
    c.border = box
for cell in ("B18", "B19"):
    co[cell].number_format = "0.0%"
for cell in ("A1", "B1"):
    co[cell].font = head
    co[cell].fill = PatternFill("solid", start_color=SEA)
co.column_dimensions["A"].width = 28
co.column_dimensions["B"].width = 34
co["B19"].comment = Comment("Saint Lucia: 5% of up to $5,000 a month, so $250 maximum. Check your country's current limit.", "Platform")
co["B21"].comment = Comment("Calculated uses the country's tax bands. Fixed amount keeps the PAYE entered per employee.", "Platform")
co["B22"].comment = Comment("Yes adds the QuickBooks accounts to this company's mapping screen. No means payroll stays local.", "Platform")
for cell, values in (
    ("B3", "Saint Lucia,Antigua and Barbuda,St Kitts and Nevis,Dominica,Grenada"),
    ("B11", "Monthly,Semi-monthly,Weekly"),
    ("B20", "Total pay,Basic pay"),
    ("B21", "Calculated,Fixed amount"),
    ("B22", "Yes,No"),
):
    dv = DataValidation(type="list", formula1=f'"{values}"', allow_blank=True)
    co.add_data_validation(dv)
    dv.add(co[cell])

# 3. Employees (full HR folder) ----------------------------------------------
emp = wb.create_sheet("Employees")
columns = [
    ("FIRST NAME", 16, True), ("LAST NAME", 16, True), ("DEPARTMENT", 18, False), ("JOB TITLE", 20, False),
    ("EMPLOYEE NUMBER", 16, False), ("NIC NO", 14, False), ("TAN NO", 12, False), ("DATE HIRED", 14, False),
    ("WORK EMAIL", 26, False), ("PERSONAL EMAIL", 24, False), ("PHONE", 16, False),
    ("DATE OF BIRTH", 14, False), ("GENDER", 12, False), ("MARITAL STATUS", 14, False), ("NATIONALITY", 14, False),
    ("ADDRESS", 24, False), ("CITY", 14, False), ("COUNTRY OF RESIDENCE", 16, False),
    ("EMERGENCY CONTACT NAME", 20, False), ("EMERGENCY RELATIONSHIP", 18, False), ("EMERGENCY PHONE", 16, False),
    ("EMPLOYMENT TYPE", 16, False), ("WORK LOCATION", 18, False), ("SUPERVISOR", 16, False), ("SCHEDULE", 18, False),
    ("PROBATION END", 14, False), ("CONTRACT END", 14, False), ("STATUS", 12, False),
    ("PAY FREQUENCY", 15, False), ("PAY RATE", 13, False), ("WEEKLY HOURS", 13, False), ("HOURS PER DAY", 13, False),
    ("O/T RATE", 11, False), ("STAFF GROUP", 13, False), ("COST CENTRE CODE", 14, False),
    ("TAX CODE", 11, False), ("TAX METHOD", 14, False), ("FIXED PAYE", 12, False), ("NIC BASIS", 12, False),
    ("DAILY RATE RULE", 22, False), ("FIXED DAILY RATE", 14, False),
    ("BANK NAME", 20, False), ("BANK BRANCH", 16, False), ("BANK ACCOUNT NUMBER", 18, False), ("BANK ACCOUNT TYPE", 15, False),
    ("TERMINATION DATE", 15, False), ("TERMINATION REASON", 24, False), ("NOTES", 30, False),
]
for i, (label, width, _) in enumerate(columns, 1):
    c = emp.cell(1, i, label)
    c.font = head
    c.fill = PatternFill("solid", start_color=SEA if i <= 28 else CORAL)
    c.alignment = Alignment(wrap_text=True, horizontal="center", vertical="center")
    c.border = box
    emp.column_dimensions[c.column_letter].width = width
emp.row_dimensions[1].height = 34
people = [
    {"FIRST NAME": "Example", "LAST NAME": "Person One", "DEPARTMENT": "Administration", "JOB TITLE": "Office Clerk",
     "EMPLOYEE NUMBER": "E001", "NIC NO": "100001", "TAN NO": "T-1001", "DATE HIRED": "2021-03-01",
     "WORK EMAIL": "example1@example.com", "PHONE": "+1 758 000 0001", "DATE OF BIRTH": "1990-05-14",
     "GENDER": "Female", "MARITAL STATUS": "Single", "NATIONALITY": "Saint Lucia", "ADDRESS": "12 Example Road",
     "CITY": "Castries", "COUNTRY OF RESIDENCE": "Saint Lucia", "EMERGENCY CONTACT NAME": "A. Person",
     "EMERGENCY RELATIONSHIP": "Sister", "EMERGENCY PHONE": "+1 758 000 0011", "EMPLOYMENT TYPE": "Full-time",
     "WORK LOCATION": "Head office", "SUPERVISOR": "Example Supervisor", "SCHEDULE": "Mon-Fri 8:00-16:00",
     "PROBATION END": "2021-06-01", "STATUS": "Active", "PAY FREQUENCY": "Monthly", "PAY RATE": "3000",
     "WEEKLY HOURS": "40", "HOURS PER DAY": "8", "O/T RATE": "1.5", "STAFF GROUP": "Staff",
     "COST CENTRE CODE": "ADM", "TAX CODE": "264M", "TAX METHOD": "Fixed amount", "FIXED PAYE": "133.13",
     "NIC BASIS": "Total pay", "DAILY RATE RULE": "Monthly × 12 ÷ 52 ÷ 5", "BANK NAME": "Bank of Saint Lucia",
     "BANK BRANCH": "Castries", "BANK ACCOUNT NUMBER": "123456789", "BANK ACCOUNT TYPE": "Savings"},
    {"FIRST NAME": "Example", "LAST NAME": "Person Two", "DEPARTMENT": "Sales", "JOB TITLE": "Field Sales Officer",
     "EMPLOYEE NUMBER": "E002", "NIC NO": "100002", "DATE HIRED": "2022-07-15", "WORK EMAIL": "example2@example.com",
     "PHONE": "+1 758 000 0002", "EMPLOYMENT TYPE": "Full-time", "WORK LOCATION": "Island-wide",
     "SUPERVISOR": "Example Supervisor", "SCHEDULE": "Mon-Sat", "STATUS": "Active", "PAY FREQUENCY": "Weekly",
     "PAY RATE": "500", "WEEKLY HOURS": "44", "HOURS PER DAY": "8", "O/T RATE": "1.5", "STAFF GROUP": "Staff",
     "COST CENTRE CODE": "SAL", "TAX CODE": "264M", "TAX METHOD": "Calculated", "NIC BASIS": "Total pay",
     "DAILY RATE RULE": "Monthly × 12 ÷ 52 ÷ 5", "BANK NAME": "Bank of Saint Lucia", "BANK BRANCH": "Castries",
     "BANK ACCOUNT NUMBER": "987654321", "BANK ACCOUNT TYPE": "Savings"},
    {"FIRST NAME": "Example", "LAST NAME": "Director", "DEPARTMENT": "Management", "JOB TITLE": "Managing Director",
     "EMPLOYEE NUMBER": "E003", "NIC NO": "100003", "DATE HIRED": "2015-01-05", "WORK EMAIL": "director@example.com",
     "EMPLOYMENT TYPE": "Full-time", "WORK LOCATION": "Head office", "SCHEDULE": "Mon-Fri", "STATUS": "Active",
     "PAY FREQUENCY": "Monthly", "PAY RATE": "15000", "WEEKLY HOURS": "45", "HOURS PER DAY": "9", "O/T RATE": "1.5",
     "STAFF GROUP": "Director", "COST CENTRE CODE": "MGT", "TAX CODE": "360M", "TAX METHOD": "Fixed amount",
     "FIXED PAYE": "3212.50", "NIC BASIS": "Basic pay", "DAILY RATE RULE": "Monthly × 12 ÷ 52 ÷ 5",
     "BANK NAME": "Bank of Saint Lucia", "BANK BRANCH": "Castries", "BANK ACCOUNT NUMBER": "555666777",
     "BANK ACCOUNT TYPE": "Savings"},
]
labels = {label: i for i, (label, _, _) in enumerate(columns, 1)}
for n, person in enumerate(people):
    r = 2 + n
    for label, value in person.items():
        c = emp.cell(r, labels[label], value)
        c.font = blue
        c.border = box
for r in range(2, 2 + len(people)):
    for label in ("PAY RATE", "FIXED PAYE", "FIXED DAILY RATE"):
        emp.cell(r, labels[label]).number_format = MONEY
for label, values in (
    ("GENDER", "Female,Male,Other,Not stated"),
    ("MARITAL STATUS", "Single,Married,Common-law,Divorced,Widowed"),
    ("EMPLOYMENT TYPE", "Full-time,Part-time,Contract,Temporary,Intern"),
    ("STATUS", "Active,Inactive,On Leave"),
    ("PAY FREQUENCY", "Monthly,Semi-monthly,Fortnightly,Weekly,Daily,Hourly"),
    ("STAFF GROUP", "Staff,Management,Director,Casual"),
    ("TAX METHOD", "Calculated,Fixed amount"),
    ("NIC BASIS", "Total pay,Basic pay"),
    ("DAILY RATE RULE", "Monthly × 12 ÷ 52 ÷ 5,Fixed daily rate"),
    ("BANK ACCOUNT TYPE", "Savings,Current,Cheque"),
):
    letter = emp.cell(1, labels[label]).column_letter
    dv = DataValidation(type="list", formula1=f'"{values}"', allow_blank=True)
    emp.add_data_validation(dv)
    dv.add(f"{letter}2:{letter}500")
emp["AC1"].comment = Comment("Use the same person's name on the Payroll, Allowances & Deductions and Loans sheets so the platform can match the rows.", "Platform")
emp.freeze_panes = "C2"

# 4. Payroll (current period) -------------------------------------------------
pay = wb.create_sheet("Payroll")
labels_pay = ["NAME", "DEPARTMENT", "NIC NO", "EMPLOYEE NUMBER", "DATE HIRED", "STAFF GROUP", "TAX CODE", "TAX METHOD",
              "BASIC SALARY", "DAYS NOT WORKED", "DAILY RATE", "HOURLY RATE", "O/T HOURS 1.5X", "DOUBLE TIME HOURS",
              "TRAVEL", "PHONE", "ON CALL", "COMMISSION", "OTHER ALLOWANCE", "TOTAL SALARY", "NIC 5%", "PAYE",
              "SALARY DEDUCTION", "OTHER DEDUCTION", "NET SALARY"]
pay["A1"] = "Monthly payroll - one row per employee (blue = you enter, black = worked out)"
pay["A1"].font = Font(name=FONT, bold=True, color=SEA, size=13)
for i, label in enumerate(labels_pay, 1):
    c = pay.cell(2, i, label)
    c.font = head
    c.fill = PatternFill("solid", start_color=CORAL if i >= 20 else SEA)
    c.alignment = Alignment(wrap_text=True, horizontal="center", vertical="center")
    c.border = box
    pay.column_dimensions[c.column_letter].width = 22 if i == 1 else 14
pay.row_dimensions[2].height = 32
ot = f"Company!$B${ROW['Overtime multiplier']}"
dt = f"Company!$B${ROW['Double-time multiplier']}"
hpd = f"Company!$B${ROW['Hours per working day']}"
nic_rate = f"Company!$B${ROW['Employee NIC rate']}"
nic_max = f"Company!$B${ROW['NIC monthly maximum']}"
nic_on = f"Company!$B${ROW['NIC worked out on']}"
examples = [
    {1: "Example Person One", 2: "Administration", 3: "100001", 4: "E001", 5: "2021-03-01", 6: "Staff", 7: "264M", 8: "Fixed amount", 9: 3000, 17: 250, 22: 133.13},
    {1: "Example Person Two", 2: "Sales", 3: "100002", 4: "E002", 5: "2022-07-15", 6: "Staff", 7: "264M", 8: "Calculated", 9: 2000, 10: -1, 13: 6, 14: 2, 15: 300, 18: 150, 24: 50},
    {1: "Example Director", 2: "Management", 3: "100003", 4: "E003", 5: "2015-01-05", 6: "Director", 7: "360M", 8: "Fixed amount", 9: 15000, 22: 3212.5},
]
first = 4
for n, entries in enumerate(examples):
    r = first + n
    for col, value in entries.items():
        pay.cell(r, col, value).font = blue
    pay.cell(r, 11, f"=I{r}*12/52/5")
    pay.cell(r, 12, f"=K{r}/{hpd}")
    pay.cell(r, 20, f"=I{r}+J{r}*K{r}+M{r}*L{r}*{ot}+N{r}*L{r}*{dt}+SUM(O{r}:S{r})")
    pay.cell(r, 21, f'=MIN(IF({nic_on}="Basic pay",I{r},T{r})*{nic_rate},{nic_max})')
    pay.cell(r, 25, f"=T{r}-U{r}-V{r}-W{r}-X{r}")
    for col in (11, 12, 20, 21, 25):
        pay.cell(r, col).font = body
last = first + len(examples) - 1
total_row = last + 2
pay.cell(total_row, 1, "GRAND TOTAL").font = Font(name=FONT, bold=True)
for col in (9, 20, 21, 22, 23, 24, 25):
    letter = pay.cell(2, col).column_letter
    c = pay.cell(total_row, col, f"=SUM({letter}{first}:{letter}{total_row - 1})")
    c.font = Font(name=FONT, bold=True)
for row in pay.iter_rows(min_row=first, max_row=total_row, min_col=9, max_col=25):
    for c in row:
        if c.column not in (10, 13, 14):
            c.number_format = MONEY
pay.freeze_panes = "B4"
for col, values in (("F", "Staff,Management,Director,Casual"), ("H", "Calculated,Fixed amount")):
    dv = DataValidation(type="list", formula1=f'"{values}"', allow_blank=True)
    pay.add_data_validation(dv)
    dv.add(f"{col}{first}:{col}500")
pay["J2"].comment = Comment("Enter days not worked as a minus number, e.g. -2.", "Platform")
pay["G2"].comment = Comment("Tax code from the employee's tax declaration, e.g. 264M.", "Platform")
pay["V2"].comment = Comment("Only needed when Tax method is 'Fixed amount'.", "Platform")

# 5. Allowances & Deductions --------------------------------------------------
ad = wb.create_sheet("Allowances & Deductions")
ad.append(["Employee name", "Type", "Description", "Monthly amount", "Every month?", "Creditor / lender"])
ad.append(["Example Person One", "Allowance", "On-call allowance", 250, "Yes", ""])
ad.append(["Example Person Two", "Deduction", "Medical insurance", 50, "Yes", "National Insurance Board"])
dv = DataValidation(type="list", formula1='"Allowance,Deduction"', allow_blank=False)
ad.add_data_validation(dv)
dv.add("B2:B500")
dv = DataValidation(type="list", formula1='"Yes,No"', allow_blank=True)
ad.add_data_validation(dv)
dv.add("E2:E500")

# 6. Loans & Balances ---------------------------------------------------------
lo = wb.create_sheet("Loans & Balances")
lo.append(["Employee name", "Lender / creditor", "Original amount", "Balance still owed", "Monthly repayment", "Notes"])
lo.append(["Example Person Two", "Company staff advance", 1200, 800, 100, "Advance from July"])

# 7. Accounts (payroll item -> accounting code) -------------------------------
ac = wb.create_sheet("Accounts")
ac.append(["Payroll item", "Account code", "Account name", "Account type"])
accounts = [
    ("gross_wages", "66010", "Gross Wages & Salaries", "Expense"),
    ("overtime", "66040", "Overtime Premium", "Expense"),
    ("bonus_expense", "66050", "Bonus & Incentive", "Expense"),
    ("commission_expense", "66055", "Sales Commission", "Expense"),
    ("travel_allowance", "66065", "Travel / Mileage Allowance", "Expense"),
    ("uniform_allowance", "66066", "Uniform / PPE Allowance", "Expense"),
    ("employer_nic", "66070", "Employer NIC (Social Security)", "Expense"),
    ("employee_nic_payable", "21000", "NIC Payable (Statutory)", "Liability"),
    ("paye_payable", "21010", "PAYE Tax Payable", "Liability"),
    ("creditor_deductions", "21020", "Other Deductions Payable", "Liability"),
    ("union_dues", "21030", "Union Dues Payable", "Liability"),
    ("severance_pay", "66080", "Severance Pay", "Expense"),
]
for row in accounts:
    ac.append(list(row))

# 8. Departments --------------------------------------------------------------
de = wb.create_sheet("Departments")
de.append(["Department", "Cost centre code", "Basic pay account", "Overtime account", "Allowances account", "Employer NIC account", "Staff receivables account"])
de.append(["Administration", "ADM", "66010", "66040", "66065", "66070", "14000"])
de.append(["Sales", "SAL", "66035", "66040", "66065", "66070", "14000"])
de.append(["Management", "MGT", "66080", "66040", "66065", "66070", "14000"])

for ws in (ad, lo, ac, de):
    for c in ws[1]:
        c.font = head
        c.fill = PatternFill("solid", start_color=SEA)
        c.border = box
    for row in ws.iter_rows(min_row=2):
        for c in row:
            c.font = blue
            c.border = box
    for col in ws.columns:
        ws.column_dimensions[col[0].column_letter].width = 22
for ws in (ad, lo):
    for row in ws.iter_rows(min_row=2, min_col=4, max_col=5):
        for c in row:
            c.number_format = MONEY

wb.save(OUT)

# 9. Store the worked-out values beside their formulas ------------------------
# openpyxl writes formulas without cached results, so an untouched upload would read the
# worked-out columns as zero. Excel and LibreOffice store both; do the same here.
import re
import zipfile
from shutil import copyfile

emp_rate = settings[ROW["Employee NIC rate"] - 2][1]
nic_max = settings[ROW["NIC monthly maximum"] - 2][1]
nic_on = settings[ROW["NIC worked out on"] - 2][1]
hpd = settings[ROW["Hours per working day"] - 2][1]
ot_mult = settings[ROW["Overtime multiplier"] - 2][1]
dt_mult = settings[ROW["Double-time multiplier"] - 2][1]

def pay_row(entries):
    g = lambda col: entries.get(col, 0) or 0
    basic, days = g(9), g(10)
    daily = basic * 12 / 52 / 5
    hourly = daily / hpd
    allowances = sum(g(c) for c in range(15, 20))
    total = basic + days * daily + g(13) * hourly * ot_mult + g(14) * hourly * dt_mult + allowances
    nic = min((basic if nic_on == "Basic pay" else total) * emp_rate, nic_max)
    paye = g(22)
    return {9: basic, 11: daily, 12: hourly, 20: total, 21: nic, 22: paye, 23: g(23), 24: g(24),
            25: total - nic - paye - g(23) - g(24)}

cached = {}
for n, entries in enumerate(examples):
    for col, value in pay_row(entries).items():
        cached[f"{pay.cell(2, col).column_letter}{first + n}"] = round(value, 10)
for col in (9, 20, 21, 22, 23, 24, 25):
    letter = pay.cell(2, col).column_letter
    cached[f"{letter}{total_row}"] = round(sum(cached[f"{letter}{first + n}"] for n in range(len(examples))), 10)

def letter_of(ref):
    return re.match(r"[A-Z]+", ref).group(0)

def inject(xml, sheet_name):
    if sheet_name != "Payroll":
        return xml
    for ref, value in cached.items():
        if letter_of(ref) not in ("I", "K", "L", "T", "U", "V", "W", "X", "Y"):
            continue
        pattern = re.compile(r'(<c r="%s"[^>]*>)(.*?)(</c>)' % ref, re.S)
        if not pattern.search(xml):
            continue
        body = pattern.search(xml).group(2)
        body = re.sub(r"<v>.*?</v>", "", body, flags=re.S)
        body = re.sub(r"<v/>", "", body)
        xml = pattern.sub(lambda m: m.group(1) + body + f"<v>{value!r}</v>" + m.group(3), xml, count=1)
    return xml

tmp = OUT + ".tmp"
with zipfile.ZipFile(OUT) as src, zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as dst:
    for item in src.infolist():
        data = src.read(item.filename)
        if item.filename.startswith("xl/worksheets/sheet"):
            name = re.search(r"sheet\d+\.xml", item.filename).group(0)
            order = [ws.title for ws in wb.worksheets]
            index = int(re.search(r"(\d+)", name).group(1)) - 1
            data = inject(data.decode(), order[index]).encode()
        dst.writestr(item, data)
copyfile(tmp, OUT)
print(OUT)
