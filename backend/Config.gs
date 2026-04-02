const SHEET_TRIPS = 'Trips';
const SHEET_SCHEDULES = 'Schedules';

// 👑 記得一定要把這裡換成你正在用的 Google 試算表網址！
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1lYFckblUd1aXMOKwM_c-aahlK_gxOQQDqrVwToQ6Bk0/edit';

function getMySpreadsheet() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
        return SpreadsheetApp.openByUrl(SHEET_URL);
    }
    return ss;
}