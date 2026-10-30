"""Generate the customer onboarding payroll template served from public/templates.

The Payroll sheet uses the same column names the platform's sheet reader detects, so a
completed template can be uploaded straight into Payroll Import.
Run: python scripts/generate-payroll-template.py
"""
from openpyxl import Workbook
from openpyxl.comments import Comment
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.worksheet.datavalidation import DataValidation

OUT = "public/templates/Payroll_Onboarding_Template_v1.xlsx"
FONT = "Arial"
SEA, SAND, CORAL = "0E7C86", "FFF4DC", "FF6F59"
head = Font(name=FONT, bold=True, color="FFFFFF")
body = Font(name=FONT)
blue = Font(name=FONT, color="0000FF")
thin = Side(style="thin", color="BBBBBB")
box = Border(left=thin, right=thin, top=thin, bottom=thin)

wb = Workbook()

# 1. Instructions
ins = wb.active
ins.title = "Instructions"
lines = [
    ("Payroll onboarding template", True),
    ("Fill in the blue cells. Black cells are worked out for you. Then upload this file under Payroll Import.", False),
    ("", False),
    ("1. Company: country, pay frequency and the pay rules your business uses.", False),
    ("2. Payroll: one row per employee for the current month. Leave a cell blank if it does not apply.", False),
    ("   - Days not worked: enter as a minus number (e.g. -2) so the days are deducted.", False),
    ("   - Overtime hours at time-and-a-half and double-time hours go in their own columns.", False),
    ("   - Tax method: 'Calculated' lets the platform work out PAYE; 'Fixed amount' keeps the PAYE you enter.", False),
    ("3. Allowances & Deductions: amounts paid or taken every month (travel, phone, insurance, union, creditors).", False),
    ("4. Loans & Balances: staff loans or advances still owed, with the monthly repayment.", False),
    ("5. Accounts: your accounting codes for each department (used for QuickBooks).", False),
    ("", False),
    ("The example rows use fictional people. Replace or delete them before uploading.", False),
    ("Nothing is saved until an administrator reviews the import and approves it.", False),
]
for i, (text, bold) in enumerate(lines, 1):
    ins.cell(i, 1, text).font = Font(name=FONT, bold=bold, size=14 if bold else 11, color=SEA if bold else "000000")
ins.column_dimensions["A"].width = 110

# 2. Company
co = wb.create_sheet("Company")
co["A1"], co["B1"] = "Setting", "Value"
settings = [
    ("Company name", "Example Company Ltd"),
    ("Country", "Saint Lucia"),
    ("Pay frequency", "Monthly"),
    ("Overtime multiplier", 1.5),
    ("Double-time multiplier", 2),
    ("Hours per working day", 8),
    ("Working days in month", 22),
    ("Employee NIC rate", 0.05),
    ("NIC monthly maximum", 250),
    ("NIC worked out on", "Total pay"),
]
for r, (k, v) in enumerate(settings, 2):
    co.cell(r, 1, k).font = body
    c = co.cell(r, 2, v)
    c.font = blue
co["B9"].number_format = "0.0%"
for c in ("A1", "B1"):
    co[c].font = head
    co[c].fill = PatternFill("solid", start_color=SEA)
co.column_dimensions["A"].width = 28
co.column_dimensions["B"].width = 26
co["B10"].comment = Comment("Saint Lucia: 5% of up to $5,000 a month, so $250 maximum. Check your country's current limit.", "Platform")
for cell, values in (("B3", "Saint Lucia,Antigua and Barbuda,St Kitts and Nevis,Dominica,Grenada"), ("B4", "Monthly,Semi-monthly,Weekly"), ("B11", "Total pay,Basic pay")):
    dv = DataValidation(type="list", formula1=f'"{values}"', allow_blank=False)
    co.add_data_validation(dv)
    dv.add(co[cell])

# 3. Payroll (two-row header: row 2 labels, row 3 left blank, data from row 4)
pay = wb.create_sheet("Payroll")
labels = ["NAME", "DEPARTMENT", "NIC NO", "EMPLOYEE NUMBER", "DATE HIRED", "STAFF GROUP", "TAX CODE", "TAX METHOD",
          "BASIC SALARY", "DAYS NOT WORKED", "DAILY RATE", "HOURLY RATE", "O/T HOURS 1.5X", "DOUBLE TIME HOURS",
          "TRAVEL", "PHONE", "ON CALL", "COMMISSION", "OTHER ALLOWANCE", "TOTAL SALARY", "NIC 5%", "PAYE",
          "SALARY DEDUCTION", "OTHER DEDUCTION", "NET SALARY"]
pay["A1"] = "Monthly payroll - one row per employee (blue = you enter, black = worked out)"
pay["A1"].font = Font(name=FONT, bold=True, color=SEA, size=13)
for i, label in enumerate(labels, 1):
    c = pay.cell(2, i, label)
    c.font = head
    c.fill = PatternFill("solid", start_color=CORAL if i >= 20 else SEA)
    c.alignment = Alignment(wrap_text=True, horizontal="center", vertical="center")
    c.border = box
    pay.column_dimensions[c.column_letter].width = 22 if i == 1 else 14
pay.row_dimensions[2].height = 32
examples = [
    ("Example Person One", "Administration", "100001", "E001", "2021-03-01", "Staff", "264M", "Fixed amount", 3000, 0, 0, 0, 0, 0, 0, 250, 0, 0, 133.13, 0, 0),
    ("Example Person Two", "Sales", "100002", "E002", "2022-07-15", "Staff", "264M", "Calculated", 2000, -1, 6, 2, 300, 0, 0, 150, 0, None, 0, 50, 0),
    ("Example Director", "Management", "100003", "E003", "2015-01-05", "Director", "360M", "Fixed amount", 15000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3212.5, 0, 0),
]
first = 4
for n, ex in enumerate(examples):
    r = first + n
    (name, dept, nic, emp, hired, group, code, method, basic, days, ot, dt, travel, phone, oncall, comm, other, paye, sal_ded, other_ded, _) = ex + ((),) if len(ex) == 20 else ex
    entries = {1: name, 2: dept, 3: nic, 4: emp, 5: hired, 6: group, 7: code, 8: method, 9: basic, 10: days, 13: ot, 14: dt,
               15: travel, 16: phone, 17: oncall, 18: comm, 19: other, 22: paye, 23: sal_ded, 24: other_ded}
    for col, value in entries.items():
        c = pay.cell(r, col, value)
        c.font = blue
    pay.cell(r, 11, f"=I{r}*12/52/5")
    pay.cell(r, 12, f"=K{r}/Company!$B$7")
    pay.cell(r, 20, f"=I{r}+J{r}*K{r}+M{r}*L{r}*Company!$B$5+N{r}*L{r}*Company!$B$6+SUM(O{r}:S{r})")
    pay.cell(r, 21, f'=MIN(IF(Company!$B$11="Basic pay",I{r},T{r})*Company!$B$9,Company!$B$10)')
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
            c.number_format = '#,##0.00;(#,##0.00);"-"'
pay.freeze_panes = "B4"
for col, values in (("F", "Staff,Management,Director,Casual"), ("H", "Calculated,Fixed amount")):
    dv = DataValidation(type="list", formula1=f'"{values}"', allow_blank=True)
    pay.add_data_validation(dv)
    dv.add(f"{col}{first}:{col}500")
pay["J2"].comment = Comment("Enter days not worked as a minus number, e.g. -2.", "Platform")
pay["G2"].comment = Comment("Tax code from the employee's tax declaration, e.g. 264M.", "Platform")
pay["V2"].comment = Comment("Only needed when Tax method is 'Fixed amount'.", "Platform")

# 4. Allowances & Deductions
ad = wb.create_sheet("Allowances & Deductions")
ad.append(["Employee name", "Type", "Description", "Monthly amount", "Every month?"])
ad.append(["Example Person One", "Allowance", "On-call allowance", 250, "Yes"])
ad.append(["Example Person Two", "Deduction", "Medical insurance", 50, "Yes"])
dv = DataValidation(type="list", formula1='"Allowance,Deduction"', allow_blank=False)
ad.add_data_validation(dv)
dv.add("B2:B500")

# 5. Loans & Balances
lo = wb.create_sheet("Loans & Balances")
lo.append(["Employee name", "Lender / creditor", "Original amount", "Balance still owed", "Monthly repayment", "Notes"])
lo.append(["Example Person Two", "Company staff advance", 1200, 800, 100, "Advance from July"])

# 6. Accounts
ac = wb.create_sheet("Accounts")
ac.append(["Department", "Basic pay account", "Overtime account", "Allowances account", "Employer NIC account", "Staff receivables account"])
ac.append(["Administration", "66010", "66040", "66065", "66070", "14000"])
ac.append(["Sales", "66035", "66040", "66065", "66070", "14000"])
ac.append(["Management", "66080", "66040", "66065", "66070", "14000"])

for ws in (ad, lo, ac):
    for c in ws[1]:
        c.font = head
        c.fill = PatternFill("solid", start_color=SEA)
    for row in ws.iter_rows(min_row=2):
        for c in row:
            c.font = blue
    for col in ws.columns:
        ws.column_dimensions[col[0].column_letter].width = 22

wb.save(OUT)
print(OUT)
