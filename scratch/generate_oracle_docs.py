import os
import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Preformatted, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas

md_path = r"c:\Documents\project\user_read_manuals\SQL_ER_DOCUMENTATION_ORACLE.md"
pdf_path = r"c:\Documents\project\user_read_manuals\SQL_Documentation_ORACLE.pdf"

# Read markdown content from file
with open(md_path, "r", encoding="utf-8") as f:
    md_content = f.read()

# Generate PDF with ReportLab
class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#718096"))
        
        # Header (pages > 1)
        if self._pageNumber > 1:
            self.drawString(54, 755, "Oracle SQL & PL/SQL Database Documentation — Enterprise Edition")
            self.setStrokeColor(colors.HexColor("#CBD5E0"))
            self.setLineWidth(0.5)
            self.line(54, 748, 558, 748)
            
        # Footer
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(558, 36, page_str)
        self.drawString(54, 36, "Confidential — Portfolio Management System (Oracle Conversion)")
        self.setStrokeColor(colors.HexColor("#CBD5E0"))
        self.setLineWidth(0.5)
        self.line(54, 48, 558, 48)
        self.restoreState()

doc = SimpleDocTemplate(
    pdf_path,
    pagesize=letter,
    leftMargin=54,
    rightMargin=54,
    topMargin=54,
    bottomMargin=54
)

styles = getSampleStyleSheet()

title_style = ParagraphStyle(
    'DocTitle',
    parent=styles['Heading1'],
    fontName='Helvetica-Bold',
    fontSize=20,
    leading=24,
    textColor=colors.HexColor("#1A365D"),
    spaceAfter=6
)

h1_style = ParagraphStyle(
    'PartHeader',
    parent=styles['Heading1'],
    fontName='Helvetica-Bold',
    fontSize=13,
    leading=17,
    textColor=colors.HexColor("#0D3B66"),
    spaceBefore=14,
    spaceAfter=8,
    keepWithNext=True
)

h2_style = ParagraphStyle(
    'ItemTitle',
    parent=styles['Heading2'],
    fontName='Helvetica-Bold',
    fontSize=10,
    leading=13,
    textColor=colors.HexColor("#2B6CB0"),
    spaceBefore=10,
    spaceAfter=4,
    keepWithNext=True
)

body_style = ParagraphStyle(
    'DocBody',
    parent=styles['Normal'],
    fontName='Helvetica',
    fontSize=8.5,
    leading=12,
    textColor=colors.HexColor("#2D3748"),
    spaceAfter=4
)

code_style = ParagraphStyle(
    'CodeBlock',
    fontName='Courier',
    fontSize=6.8,
    leading=8.8,
    textColor=colors.HexColor("#1A202C")
)

purpose_style = ParagraphStyle(
    'Purpose',
    parent=styles['Normal'],
    fontName='Helvetica-Oblique',
    fontSize=8.0,
    leading=11,
    textColor=colors.HexColor("#4A5568"),
    spaceAfter=6
)

story = []

# Title & Overview
story.append(Paragraph("Oracle SQL & PL/SQL Database Documentation", title_style))
story.append(Paragraph("Live Stock & Cryptocurrency Portfolio Management System — SQL*Plus / Oracle Enterprise Specification", ParagraphStyle('Sub', fontName='Helvetica-Bold', fontSize=9.5, textColor=colors.HexColor("#4A5568"), spaceAfter=10)))
story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#2B6CB0"), spaceAfter=10))

story.append(Paragraph("This document contains every SQL Data Definition Language (DDL), Data Manipulation Language (DML), Analytical/Reporting query, and PL/SQL Stored Procedure, Function, and Trigger converted and optimized specifically for <b>Oracle Database (12c / 19c / 21c / 23c)</b> and <b>SQL*Plus</b>. Each statement adheres strictly to Oracle syntax specifications, data types, and procedural standards.", body_style))

story.append(Paragraph("<b>Conversion Rules & Architecture Conventions:</b>", ParagraphStyle('ConvHeader', fontName='Helvetica-Bold', fontSize=9, leading=13, textColor=colors.HexColor("#1A365D"), spaceBefore=4, spaceAfter=4)))
conv_points = [
    "• <b>Identifiers & Primary Keys</b>: Converted PostgreSQL UUID / uuid_generate_v4() to Oracle <code>RAW(16) DEFAULT SYS_GUID()</code>.",
    "• <b>Character Types</b>: Converted <code>VARCHAR(n)</code> to <code>VARCHAR2(n)</code>.",
    "• <b>Boolean Logic</b>: Mapped <code>BOOLEAN</code> to <code>NUMBER(1)</code> with explicit <code>CHECK (col IN (0, 1))</code> constraints.",
    "• <b>JSON Data</b>: Converted <code>JSONB</code> to <code>CLOB</code> with an explicit <code>CHECK (metadata IS JSON)</code> constraint.",
    "• <b>Timestamps</b>: Replaced <code>DEFAULT CURRENT_TIMESTAMP</code> with <code>DEFAULT SYSTIMESTAMP</code>.",
    "• <b>Upsert Operations</b>: Replaced PostgreSQL <code>INSERT ... ON CONFLICT</code> with ANSI/Oracle <code>MERGE INTO ... USING dual</code>.",
    "• <b>Returning Clauses</b>: Converted <code>RETURNING ... INTO</code> to PL/SQL blocks with bind variables and <code>DBMS_OUTPUT.PUT_LINE</code>.",
    "• <b>Paging Syntax</b>: Converted <code>LIMIT n OFFSET m</code> to ANSI standard <code>OFFSET m ROWS FETCH NEXT n ROWS ONLY</code>.",
    "• <b>Table Functions</b>: Converted PostgreSQL <code>RETURNS TABLE</code> to Oracle PL/SQL functions returning <code>SYS_REFCURSOR</code>."
]
for cp in conv_points:
    story.append(Paragraph(cp, body_style))

story.append(Spacer(1, 8))

# Process Markdown lines
lines = md_content.split('\n')
i = 0

while i < len(lines):
    line = lines[i]
    if line.startswith("# Part "):
        story.append(Spacer(1, 6))
        story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#CBD5E0"), spaceAfter=6))
        story.append(Paragraph(line.replace("# ", ""), h1_style))
        i += 1
        continue
    elif line.startswith("### "):
        item_title = line.replace("### ", "").strip()
        story.append(Paragraph(item_title, h2_style))
        i += 1
        continue
    elif line.startswith("```sql") or line.startswith("```"):
        code_lines = []
        i += 1
        while i < len(lines) and not lines[i].startswith("```"):
            code_lines.append(lines[i])
            i += 1
        i += 1 # skip closing ```
        
        # Split code into chunks of at most 25 lines so table rows can break cleanly across pages
        chunk_size = 25
        chunks = [code_lines[j:j+chunk_size] for j in range(0, len(code_lines), chunk_size)]
        if not chunks:
            chunks = [["-- (Empty)"]]
            
        table_data = []
        for chunk in chunks:
            chunk_text = "\n".join(chunk)
            p = Preformatted(chunk_text, code_style)
            table_data.append([p])
            
        tbl = Table(table_data, colWidths=[504])
        tbl.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F7FAFC")),
            ('BOX', (0,0), (-1,-1), 0.75, colors.HexColor("#CBD5E0")),
            ('INNERGRID', (0,0), (-1,-1), 0.25, colors.HexColor("#F7FAFC")),
            ('PADDING', (0,0), (-1,-1), 4),
            ('TOPPADDING', (0,0), (-1,-1), 3),
            ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ]))
        story.append(tbl)
        story.append(Spacer(1, 3))
        continue
    elif line.startswith("**Purpose**:"):
        purpose_text = line
        if i + 1 < len(lines) and lines[i+1].startswith("**ER Diagram Check**:"):
            purpose_text += "<br/>" + lines[i+1]
            i += 1
        story.append(Paragraph(purpose_text, purpose_style))
        story.append(Spacer(1, 3))
        i += 1
        continue
    elif line.strip() == "---":
        i += 1
        continue
    elif line.strip() == "":
        i += 1
        continue
    else:
        i += 1

doc.build(story, canvasmaker=NumberedCanvas)
print(f"Generated PDF at {pdf_path}")
