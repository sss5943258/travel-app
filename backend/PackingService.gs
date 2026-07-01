// PackingService.gs

/**
 * 取得所有攜帶品項
 * GET ?action=getPackingItems
 */
function getPackingItems() {
  const ss = getMySpreadsheet();
  const sheet = ss.getSheetByName(SHEET_PACKING_ITEMS);
  if (!sheet || sheet.getLastRow() < 2) return [];

  const data = parseSheetData(sheet.getDataRange().getValues());
  // 依 sortOrder 排序
  data.sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0));
  return data;
}

/**
 * 新增攜帶品項
 * payload: { name, isEssential }
 */
function addPackingItem(payload) {
  const { name, isEssential } = payload;
  if (!name || !String(name).trim()) {
    return { status: 'error', message: '品項名稱為必填' };
  }

  const ss = getMySpreadsheet();
  const sheet = ss.getSheetByName(SHEET_PACKING_ITEMS);
  if (!sheet) {
    return { status: 'error', message: '找不到 ' + SHEET_PACKING_ITEMS + ' 工作表' };
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  // 計算目前最大 sortOrder
  let maxSortOrder = 0;
  if (sheet.getLastRow() >= 2) {
    const existing = parseSheetData(sheet.getDataRange().getValues());
    existing.forEach(item => {
      const so = Number(item.sortOrder) || 0;
      if (so > maxSortOrder) maxSortOrder = so;
    });
  }

  const itemId = Utilities.getUuid();
  const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');

  const newRow = headers.map(h => {
    if (h === 'itemId')      return itemId;
    if (h === 'name')        return String(name).trim();
    if (h === 'isEssential') return isEssential ? 'TRUE' : 'FALSE';
    if (h === 'checked')     return 'FALSE';
    if (h === 'sortOrder')   return maxSortOrder + 1;
    if (h === 'createdAt')   return now;
    return '';
  });

  sheet.appendRow(newRow);
  SpreadsheetApp.flush();

  return {
    status: 'success',
    message: '新增成功',
    itemId,
    name: String(name).trim(),
    isEssential: !!isEssential,
    checked: false,
    sortOrder: maxSortOrder + 1,
  };
}

/**
 * 刪除攜帶品項
 * payload: { itemId }
 */
function deletePackingItem(payload) {
  const { itemId } = payload;
  if (!itemId) return { status: 'error', message: '缺少 itemId' };

  const ss = getMySpreadsheet();
  const sheet = ss.getSheetByName(SHEET_PACKING_ITEMS);
  if (!sheet || sheet.getLastRow() < 2) {
    return { status: 'error', message: '找不到品項' };
  }

  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const colIdx = headers.indexOf('itemId');

  for (let i = values.length - 1; i >= 1; i--) {
    if (String(values[i][colIdx]) === String(itemId)) {
      sheet.deleteRow(i + 1);
      SpreadsheetApp.flush();
      return { status: 'success', message: '刪除成功' };
    }
  }

  return { status: 'error', message: '找不到指定品項' };
}

/**
 * 切換攜帶品項的勾選狀態
 * payload: { itemId, checked }   ← checked: true / false
 */
function togglePackingItem(payload) {
  const { itemId, checked } = payload;
  if (!itemId) return { status: 'error', message: '缺少 itemId' };
  if (checked === undefined || checked === null) {
    return { status: 'error', message: '缺少 checked 參數' };
  }

  const ss = getMySpreadsheet();
  const sheet = ss.getSheetByName(SHEET_PACKING_ITEMS);
  if (!sheet || sheet.getLastRow() < 2) {
    return { status: 'error', message: '找不到品項' };
  }

  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const itemIdColIdx = headers.indexOf('itemId');
  const checkedColIdx = headers.indexOf('checked');

  if (checkedColIdx === -1) {
    return { status: 'error', message: '工作表缺少 checked 欄位' };
  }

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][itemIdColIdx]) === String(itemId)) {
      sheet.getRange(i + 1, checkedColIdx + 1).setValue(checked ? 'TRUE' : 'FALSE');
      SpreadsheetApp.flush();
      return { status: 'success', message: '更新成功', itemId, checked: !!checked };
    }
  }

  return { status: 'error', message: '找不到指定品項' };
}
