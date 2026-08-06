import { createClient } from '@supabase/supabase-js';
import Chart from 'chart.js/auto';
import { jsPDF } from 'jspdf';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import * as XLSX from 'xlsx';

window.supabase = { createClient };
window.Chart = Chart;
window.jspdf = { jsPDF };
window.PDFLib = { PDFDocument, StandardFonts, rgb };
window.XLSX = XLSX;
