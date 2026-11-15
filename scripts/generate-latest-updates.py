"""Prepend 'Latest updates - how to' pages to manual v12 -> v13 and brochure v8 -> v9.
Rerun after generate-whats-new.py. Text-only pages describing verified behaviour."""
import importlib.util
from pathlib import Path
spec = importlib.util.spec_from_file_location('wn', Path(__file__).with_name('generate-whats-new.py'))
wn = importlib.util.module_from_spec(spec); spec.loader.exec_module(wn)
TEAL, CORAL, SUN, LEAF, SEA = wn.TEAL, wn.CORAL, wn.SUN, wn.LEAF, wn.SEA

wn.TASKS[:] = [
 ("Find your way around", TEAL, [
  ("Every card opens its details", ["Tap any coloured card, flag or count (Dashboard, Attendance, AI Paymaster) to open the records behind it.", "Tap the card again to close. Use the button in the panel to jump to the page where you can fix it."]),
  ("Menu names", ["'Deductions' is now 'Additions and Deductions'.", "Clock devices is shown to Admins and Pay Masters only."]),
  ("Same figures for everyone", ["Run Payroll drafts are shared: an Admin and a Pay Master see the same edits for the same company."]),
 ]),
 ("Prepare & run payroll", LEAF, [
  ("Prepare a payroll on the AI Paymaster page", ["AI Paymaster > Prepare a payroll. Choose the period; figures start from the last saved payroll.", "Type over basic, overtime, NIC, PAYE or other per person. Totals update at once.", "Save draft > Review payroll > Approve and save payroll. Nothing is saved to payroll until you approve."]),
  ("Edit or remove a loan line", ["Run Payroll > Edit pay: lower or remove this period's loan repayment. The loan balance moves only by what is approved."]),
  ("Reusable additions and deductions", ["Additions and Deductions > Templates > Add template (name, amount, frequency).", "When adding a line for an employee, choose 'Start from a template'."]),
  ("Payment frequency for every item", ["Loans, deductions and additions each have their own frequency, amount, start and end dates, and Stop / Restart."]),
 ]),
 ("Hours, lateness & margin", SUN, [
  ("Shift round-up", ["A shift of 7.51 to 7.99 hours counts as 8 hours, for every company."]),
  ("Clock margin", ["Attendance > company clock setup > Clock margin (minutes), default 15.", "Clocking in within the margin is not late; working within it past the shift or lunch is not overtime.", "Minutes late are still recorded every day."]),
  ("Absentee & Leave Summary", ["Tap an employee's name to see each day: start time, clock-in, minutes late and status (Late, Within margin, Leave, Absent)."]),
  ("Overnight shifts", ["Roster hours count a shift that passes midnight on its clock-in day and site."]),
 ]),
 ("Clocks & locations", CORAL, [
  ("Punch locations", ["Location links on Attendance and Monitoring open in Google Maps."]),
  ("Offline punches", ["Phones never store the PIN. Offline punches sync after the employee re-enters code + PIN.", "If the phone cannot store a punch, it says 'Punch NOT saved' - clock again when online."]),
  ("Admins without an employee folder", ["On the staff clock, choose the Employee PIN option to punch for staff."]),
 ]),
 ("Costs & reports", SEA, [
  ("Project labour cost", ["Project Profitability uses approved payslip pay split by logged hours. Hours with no approved payroll show 'no approved payroll yet'."]),
  ("Pay earned & today's payroll", ["Attendance > All shifts > Pay earned. Dashboard > Payroll earned today covers all your companies."]),
  ("Staff names in reports", ["Attendance reports show every employee by name, including staff on leave who clocked in."]),
 ]),
]

if __name__ == '__main__':
    pages = [wn.intro] + [wn.section(i) for i in range(len(wn.TASKS))]
    wn.build('OECS_User_Manual_v12.pdf', 'OECS_User_Manual_v13.pdf', 'User Guide v13', pages)
    wn.build('OECS_Brochure_v8.pdf', 'OECS_Brochure_v9.pdf', 'Brochure v9', [wn.intro])
