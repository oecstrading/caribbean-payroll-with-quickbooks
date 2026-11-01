"""Deterministic A4 layouts with labelled UI illustrations and short visual steps."""
from pathlib import Path
from datetime import datetime, timezone
from xml.sax.saxutils import escape
import subprocess
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.graphics.barcode import qr
from reportlab.graphics.shapes import Drawing
from reportlab.graphics import renderPDF
from visual_guide_content import USER, SETUP

ROOT = Path(__file__).resolve().parents[1]
W, H = A4
BLUE, SEA, CORAL, GOLD = '#0063C7', '#07826A', '#D9564F', '#FFD000'
INK, MUTED, PAPER, LINE = '#1A2433', '#526277', '#F4F7FA', '#DDE5ED'
WHITE = '#FFFFFF'
PUBLIC = 'https://caribbean-payroll-with-quickbooks.lovable.app'
for name, pattern in [('Guide', 'DejaVu Sans'), ('GuideBold', 'DejaVu Sans:bold')]:
    pdfmetrics.registerFont(TTFont(name, subprocess.check_output(['fc-match', '-f', '%{file}', pattern], text=True).strip()))
pdfmetrics.registerFontFamily('Guide', normal='Guide', bold='GuideBold', italic='Guide', boldItalic='GuideBold')

def box(c, x, y, w, h, fill, radius=6, stroke=None):
    c.setFillColor(colors.HexColor(fill))
    c.setStrokeColor(colors.HexColor(stroke or fill))
    c.roundRect(x, y, w, h, radius, stroke=bool(stroke), fill=1)

def text(c, value, x, top, width, size=10, color=INK, bold=False, max_h=200):
    style = ParagraphStyle('g', fontName='GuideBold' if bold else 'Guide', fontSize=size,
                           leading=size*1.45, textColor=colors.HexColor(color))
    p = Paragraph(escape(value).replace('\n', '<br/>'), style)
    _, height = p.wrap(width, max_h)
    if height > max_h:
        raise ValueError(f'Text overflow ({height}>{max_h}): {value}')
    p.drawOn(c, x, top-height)
    return height

def arrow(c, x, y, color=BLUE):
    c.setStrokeColor(colors.HexColor(color)); c.setLineWidth(1.8)
    c.line(x-5,y,x+5,y); c.line(x+1,y+4,x+5,y); c.line(x+1,y-4,x+5,y)

def footer(c, edition, n, total):
    c.setStrokeColor(colors.HexColor(LINE)); c.line(36,45,W-36,45)
    text(c, f'OECS HR & Payroll  /  {edition}',36,32,430,7.5,color=MUTED)
    c.setFont('Guide',8); c.setFillColor(colors.HexColor(MUTED)); c.drawRightString(W-36,22,f'{n} / {total}')

def flow(c, labels):
    width=W-72; gap=17; tw=(width-gap*(len(labels)-1))/len(labels)
    for i,label in enumerate(labels):
        x=36+i*(tw+gap)
        box(c,x,555,tw,46,PAPER)
        text(c,label,x+8,588,tw-16,9,bold=True,max_h=35)
        if i<len(labels)-1: arrow(c,x+tw+gap/2,578)

def phone(c, p):
    x,y,w,h=42,219,223,308
    box(c,x,y,w,h,INK,18)
    box(c,x+8,y+9,w-16,h-18,WHITE,12)
    box(c,x+79,y+h-17,65,5,INK,2)
    text(c,'OECS HR & Payroll',x+22,y+h-39,w-44,10,color=BLUE,bold=True)
    for i,label in enumerate(p['screen']):
        cy=y+h-112-i*52
        fill=BLUE if i==len(p['screen'])-1 else PAPER
        box(c,x+20,cy,w-40,44,fill,5)
        text(c,label,x+29,cy+34,w-58,9,color=WHITE if fill==BLUE else INK,bold=i==len(p['screen'])-1,max_h=33)
    text(c,'ILLUSTRATION • NOT A LIVE SCREEN',x+5,y-12,w-10,6.5,color=MUTED,max_h=20)

def journey(c,p):
    x,y,w=42,242,223
    for i,label in enumerate(p['screen']):
        by=y+211-i*60
        box(c,x,by,w,48,BLUE if i%2==0 else SEA)
        text(c,label,x+14,by+36,w-28,11,color=WHITE,bold=True,max_h=34)
        if i<3:
            c.setStrokeColor(colors.HexColor(CORAL)); c.line(x+w/2,by-3,x+w/2,by-10)
    text(c,'ILLUSTRATED WORKFLOW',x,y-8,w,7,color=MUTED)

def body(c,p,n,total,edition):
    box(c,0,H-15,W,15,SEA,0)
    text(c,p['role'],36,H-37,W-72,9,color=SEA,bold=True)
    text(c,p['title'],36,H-64,W-72,24,bold=True,max_h=73)
    text(c,p['path'],36,H-145,W-72,10,color=MUTED,max_h=42)
    flow(c,p['flow'])
    if p['kind']=='journey': journey(c,p)
    else: phone(c,p)
    for i,(heading,desc) in enumerate(p['steps']):
        top=526-i*108
        box(c,289,top-26,26,26,[BLUE,SEA,CORAL][i],13)
        text(c,str(i+1),297,top-4,15,11,color=WHITE,bold=True,max_h=22)
        text(c,heading,325,top,230,12,bold=True,max_h=36)
        text(c,desc,289,top-40,266,9.4,max_h=68)
    box(c,36,123,W-72,62,PAPER)
    text(c,'CHECK BEFORE YOU CONTINUE',48,174,W-96,8,color=SEA,bold=True)
    text(c,p['check'],48,157,W-96,9.2,max_h=32)
    if p['note']:
        text(c,p['note'],36,107,W-72,8.3,color=MUTED,max_h=51)
    footer(c,edition,n,total)
    c.bookmarkPage(f'page{n}'); c.addOutlineEntry(p['title'],f'page{n}',0,False)
    c.showPage()

def cover(c,title,subtitle,edition,total):
    box(c,0,H-16,W,16,SEA,0)
    text(c,'CARIBBEAN WORKFORCE • HUMAN APPROVAL',36,H-43,W-72,9,color=SEA,bold=True)
    text(c,'OECS HR & Payroll',36,H-77,W-72,29,bold=True,max_h=50)
    text(c,title,36,H-138,W-72,21,color=BLUE,bold=True,max_h=65)
    c.drawImage(str(ROOT/'src/assets/payroll-visual-guide.jpg'),36,330,W-72,330,mask='auto')
    # Image position is fixed below the title band.
    text(c,subtitle,36,306,W-72,13,bold=True,max_h=54)
    text(c,'Install → Clock → Resolve → Prepare → Approve → Report',36,239,W-72,10,color=SEA,bold=True,max_h=36)
    text(c,'Visual steps for staff, payroll managers and company administrators. Fictional illustrations; no private employee records.',36,204,370,10,max_h=56)
    code=qr.QrCodeWidget(PUBLIC+'/training-public'); bounds=code.getBounds(); d=Drawing(74,74,transform=[74/(bounds[2]-bounds[0]),0,0,74/(bounds[3]-bounds[1]),0,0]); d.add(code); renderPDF.draw(d,c,W-119,111)
    text(c,'Training Hub',W-126,103,95,8,color=BLUE,max_h=20)
    c.linkURL(PUBLIC+'/training-public',(W-126,83,W-36,186),relative=0)
    text(c,f'{edition}  •  Updated {datetime.now(timezone.utc).strftime("%d %B %Y")}',36,119,370,9,color=MUTED,max_h=24)
    text(c,'AI assists. The manager approves. Wage payment stays separate.',36,88,W-72,9,bold=True,max_h=26)
    footer(c,edition,1,total); c.showPage()

def build_visual(filename,title,subtitle,edition,pages):
    dest=ROOT/'public/training'/filename
    dest.parent.mkdir(parents=True,exist_ok=True)
    c=canvas.Canvas(str(dest),pagesize=A4)
    c.setTitle(f'OECS HR & Payroll — {title}'); c.setAuthor('OECS HR & Payroll'); c.setSubject(subtitle)
    total=len(pages)+1
    cover(c,title,subtitle,edition,total)
    for n,p in enumerate(pages,2): body(c,p,n,total,edition)
    c.save(); print(f'{dest} ({total} pages)')

def build_current_guides():
    build_visual('OECS_User_Manual_v8.pdf','Visual User Guide','The complete employee-to-approved-payroll journey','User Guide v8',USER)
    build_visual('OECS_Company_Setup_Guide_v1.pdf','Company Setup Guide','From existing spreadsheets to your first reviewed payroll','Setup Guide v1',SETUP)