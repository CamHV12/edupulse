
/**
 * BACKEND GOOGLE APPS SCRIPT
 */

const SPREADSHEET_ID = '1am219_obcXAwskBCpx3aiA3PWLnS6_LidM-NVxHztkM';
const SHEETS = {
  USERS: 'Users',
  SUBJECTS: 'Subjects',
  LESSONS: 'Lessons',
  QUESTIONS: 'Questions',
  RESULTS: 'Results',
  MAINTENANCE: 'Maintenance'
};

function doGet(e) {
  try {
    const action = e.parameter.action;
    if (!action) return jsonResponse({ error: 'No action specified' });
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    if (action === 'init') {
      const userSheet = ss.getSheetByName(SHEETS.USERS);
      const userData = getSheetData(userSheet);
      
      const classes = Array.from(new Set(userData.map(u => String(u.Class || '').trim()))).filter(Boolean);
      
      const students = userData.filter(u => {
        const role = String(u.Role || 'Student').toLowerCase();
        return role !== 'admin' && role !== 'teacher';
      }).map(u => ({
        account: u.Account,
        name: u.Name,
        className: u.Class,
        email: u.Email,
        role: u.Role
      }));

      return jsonResponse({
        users: userData,
        subjects: getSheetData(ss.getSheetByName(SHEETS.SUBJECTS)),
        lessons: getSheetData(ss.getSheetByName(SHEETS.LESSONS)),
        questions: getSheetData(ss.getSheetByName(SHEETS.QUESTIONS)),
        results: getSheetData(ss.getSheetByName(SHEETS.RESULTS)),
        maintenance: getSheetData(ss.getSheetByName(SHEETS.MAINTENANCE)),
        allClasses: classes,
        students: students
      });
    }
    return jsonResponse({ error: 'Invalid action' });
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

function doPost(e) {
  try {
    const postData = JSON.parse(e.postData.contents);
    const action = postData.action;
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    if (action === 'login') {
      const { account, password } = postData;
      const maintenanceData = getSheetData(ss.getSheetByName(SHEETS.MAINTENANCE));
      if (maintenanceData.length > 0 && maintenanceData[0].Maintenance === 'ON') {
        return jsonResponse({ success: false, message: 'Hệ thống bảo trì.' });
      }
      const sheet = ss.getSheetByName(SHEETS.USERS);
      const data = getSheetData(sheet);
      const userIndex = data.findIndex(u => 
        String(u.Account).trim() === String(account).trim() && 
        String(u.Password).trim() === String(password).trim()
      );
      if (userIndex > -1) {
        const user = data[userIndex];
        if (String(user.Active || 'ON').toUpperCase() !== 'ON') return jsonResponse({ success: false, message: 'Tài khoản khóa.' });
        sheet.getRange(userIndex + 2, 5).setValue('ON');
        return jsonResponse({ 
          success: true, 
          user: { 
            account: user.Account, 
            name: user.Name, 
            className: user.Class,
            email: user.Email, 
            progress: 'ON', 
            active: 'ON', 
            role: user.Role,
            subjectTeacher: user['Subject Teacher'] || '' 
          } 
        });
      }
      return jsonResponse({ success: false, message: 'Tài khoản hoặc mật khẩu không chính xác.' });
    }

    if (action === 'saveItem') {
      const { sheetName, item, idKey } = postData;
      const sheet = ss.getSheetByName(sheetName);
      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      
      // Tìm index cột ID không phân biệt hoa thường
      const idIdx = headers.findIndex(h => String(h).toLowerCase() === String(idKey).toLowerCase());
      if (idIdx === -1) return jsonResponse({ success: false, message: 'Không tìm thấy cột ID: ' + idKey });

      const rowData = headers.map(h => item[h] !== undefined ? item[h] : '');
      const existingRowIdx = data.findIndex((row, idx) => idx > 0 && String(row[idIdx]).trim() === String(item[idKey]).trim());

      if (existingRowIdx > -1) {
        sheet.getRange(existingRowIdx + 1, 1, 1, headers.length).setValues([rowData]);
      } else {
        sheet.appendRow(rowData);
      }
      return jsonResponse({ success: true });
    }

    if (action === 'deleteItem') {
      const { sheetName, idValue, idKey } = postData;
      const sheet = ss.getSheetByName(sheetName);
      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      
      // Tìm index cột ID không phân biệt hoa thường
      const idIdx = headers.findIndex(h => String(h).toLowerCase() === String(idKey).toLowerCase());
      if (idIdx === -1) return jsonResponse({ success: false, message: 'Không tìm thấy cột ID: ' + idKey });

      const rowIdx = data.findIndex((row, idx) => idx > 0 && String(row[idIdx]).trim() === String(idValue).trim());
      if (rowIdx > -1) {
        sheet.deleteRow(rowIdx + 1);
        return jsonResponse({ success: true });
      }
      return jsonResponse({ success: false, message: 'Không tìm thấy dữ liệu có ID: ' + idValue });
    }

    if (action === 'submitResult') {
      const { result } = postData;
      const sheet = ss.getSheetByName(SHEETS.RESULTS);
      sheet.appendRow([
        result.resultId,
        result.name,
        result.role || 'Student',
        result.subjectName,
        result.lessonName,
        result.grade,
        result.score,
        result.totalQuestions,
        result.status,
        result.timeSpent,
        result.createdDate,
        result.answers
      ]);
      return jsonResponse({ success: true });
    }

    if (action === 'formatQuestions') {
      const sheet = ss.getSheetByName(SHEETS.QUESTIONS);
      const data = getSheetData(sheet);
      const formatted = data.map((item, idx) => ({ id: item.Id || item.ID || idx + 1, html: buildQuestionHtml(item, idx + 1) }));
      return jsonResponse({ success: true, formattedQuestions: formatted });
    }

    if (action === 'logout') {
      const { name } = postData;
      const sheet = ss.getSheetByName(SHEETS.USERS);
      const data = getSheetData(sheet);
      const idx = data.findIndex(u => u.Name === name);
      if (idx > -1) sheet.getRange(idx + 2, 5).setValue('OFF');
      return jsonResponse({ success: true });
    }
    return jsonResponse({ error: 'Invalid action' });
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

function getSheetData(sheet) {
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  if (rows.length < 1) return [];
  const headers = rows[0];
  const data = [];
  for (let i = 1; i < rows.length; i++) {
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      let v = rows[i][j];
      if (v instanceof Date) v = v.toLocaleString('vi-VN');
      obj[headers[j]] = v;
    }
    data.push(obj);
  }
  return data;
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Format questions from the Questions sheet into HTML-friendly markup.
 * Replaces common inline math notations like a^2, b^2, sqrt(...) into HTML (sup, √).
 * Exposed via doPost action: { action: 'formatQuestions' }
 */
function formatMathInText(text) {
  if (!text && text !== 0) return '';
  let s = String(text);
  // Escape HTML first
  s = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Replace \^ with <sup>...</sup>
  // handles x^2, b^2, x^{12}
  s = s.replace(/\^\{([^}]+)\}/g, function(_, cap) { return '<sup>' + cap + '</sup>'; });
  s = s.replace(/([A-Za-z0-9\)\]])\^(\d+)/g, function(_, base, exp) { return base + '<sup>' + exp + '</sup>'; });

  // Replace sqrt(...) or \sqrt(...) with a square root symbol
  s = s.replace(/\\?sqrt\s*\(([^)]+)\)/gi, function(_, inside) { return '√(' + inside + ')'; });

  // Replace common Delta text like Delta or \Delta with the Δ symbol
  s = s.replace(/\\?Delta\b/gi, 'Δ');

  // Replace != or <> with ≠
  s = s.replace(/(!=)|(<>)/g, '≠');

  // tidy: collapse multiple spaces
  s = s.replace(/\s+/g, ' ');
  return s;
}

function buildQuestionHtml(item, qIndex) {
  // Detect question text field name (common headers)
  const questionKeys = ['Question', 'question', 'Q', 'q', 'Stem', 'Content'];
  let questionText = '';
  for (const k of questionKeys) if (item[k]) { questionText = item[k]; break; }
  if (!questionText) {
    // fallback: try to find any header that contains 'question'
    for (const k in item) if (/question/i.test(k) && item[k]) { questionText = item[k]; break; }
  }

  const formattedQuestion = formatMathInText(questionText);

  // Find option columns (A/B/C/D) flexibly
  const optionCols = [];
  for (const k in item) {
    if (/^\s*(A|B|C|D)\b/i.test(k) || /option\s*A|option\s*B|option\s*C|option\s*D/i.test(k) || /^opt[a-d]$/i.test(k)) {
      optionCols.push({ key: k, label: k.trim() });
    }
  }
  // fallback: look for columns that start with Option
  if (optionCols.length === 0) {
    for (const k in item) if (/option/i.test(k)) optionCols.push({ key: k, label: k.trim() });
  }
  // if still none, try common names
  if (optionCols.length === 0) {
    ['A','B','C','D'].forEach(letter => { if (item[letter]) optionCols.push({ key: letter, label: letter }); });
  }

  // Build options HTML
  let optionsHtml = '';
  if (optionCols.length > 0) {
    optionsHtml += '<div class="options">';
    const labels = ['A','B','C','D'];
    for (let i = 0; i < optionCols.length; i++) {
      const col = optionCols[i];
      const optText = formatMathInText(item[col.key] || '');
      const labelLetter = labels[i] || String.fromCharCode(65 + i);
      optionsHtml += '<label style="display:block;margin:8px 0;cursor:pointer">';
      optionsHtml += '<input type="radio" name="q' + qIndex + '" style="margin-right:8px">';
      optionsHtml += '<strong>' + labelLetter + '.</strong>&nbsp; ' + optText;
      optionsHtml += '</label>';
    }
    optionsHtml += '</div>';
  }

  const html = '<div class="question">' +
               '<div class="stem" style="margin-bottom:8px">' + formattedQuestion + '</div>' +
               optionsHtml +
               '</div>';
  return html;
}

