// TripsService.gs

function getTripDetails(tripId) {
  const ss = getMySpreadsheet();

  // 1. 找旅程基本資訊
  const tripsData = parseSheetData(ss.getSheetByName(SHEET_TRIPS).getDataRange().getValues());
  const trip = tripsData.find(t => t.tripId === tripId);
  if (!trip) return { error: `找不到 tripId: ${tripId}` };

  // 2. 撈該旅程的所有行程，依 day 然後依 sortOrder 排序
  const allSchedules = parseSheetData(ss.getSheetByName(SHEET_SCHEDULES).getDataRange().getValues());
  const filtered = allSchedules.filter(s => s.tripId === tripId);

  filtered.sort((a, b) => {
    const orderA = a.sortOrder !== undefined && a.sortOrder !== "" ? Number(a.sortOrder) : 999;
    const orderB = b.sortOrder !== undefined && b.sortOrder !== "" ? Number(b.sortOrder) : 999;
    
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    return (a.startTime || "24:00").localeCompare(b.startTime || "24:00");
  });

  // 3. 組成巢狀結構
  const journeys = groupToJourneys(filtered);

  // 4. 取得旅程詳細資訊 (航班與行程備註)
  const defaultTripInfo = {
    tripId: tripId,
    outboundFlightNo: '',
    outboundAirline: '',
    outboundDepartureTime: '',
    outboundArrivalTime: '',
    outboundDepAirport: '',
    outboundArrAirport: '',
    inboundFlightNo: '',
    inboundAirline: '',
    inboundDepartureTime: '',
    inboundArrivalTime: '',
    inboundDepAirport: '',
    inboundArrAirport: '',
    flightRemark: '',
    tripRemark: ''
  };

  let tripInfo = Object.assign({}, defaultTripInfo);
  try {
    const infoSheet = ss.getSheetByName(SHEET_TRIPS_INFO);
    if (infoSheet) {
      const allInfos = parseSheetData(infoSheet.getDataRange().getValues());
      const foundInfo = allInfos.find(info => info.tripId === tripId);
      if (foundInfo) {
        tripInfo = Object.assign({}, defaultTripInfo, foundInfo);
      }
    }
  } catch (err) {
    Logger.log("讀取 Trips_Info 失敗: " + err.message);
  }

  // 5. 回傳
  return {
    tripId: trip.tripId,
    name:   trip.name,
    startDate: trip.startDate,
    endDate:   trip.endDate,
    coverUrl:  trip.coverUrl,
    journeys,
    tripInfo
  };
}

function updateTripInfo(payload) {
  const ss = getMySpreadsheet();
  const sheet = ss.getSheetByName(SHEET_TRIPS_INFO);
  if (!sheet) {
    return { status: 'error', message: '找不到 ' + SHEET_TRIPS_INFO + ' 工作表' };
  }
  
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();
  const headers = values[0];
  const tripId = payload.tripId;
  if (!tripId) {
    return { status: 'error', message: '缺少 tripId 參數' };
  }
  
  const tripIdColIdx = headers.indexOf('tripId');
  if (tripIdColIdx === -1) {
    return { status: 'error', message: '工作表缺少 tripId 欄位' };
  }
  
  let rowIndex = -1;
  for (let i = 1; i < values.length; i++) {
    if (values[i][tripIdColIdx] === tripId) {
      rowIndex = i + 1; // 1-based row index
      break;
    }
  }
  
  const updateData = payload.data || {};
  
  if (rowIndex === -1) {
    // 插入新列
    const newRow = headers.map(h => {
      if (h === 'tripId') return tripId;
      return updateData[h] !== undefined ? String(updateData[h]) : '';
    });
    sheet.appendRow(newRow);
  } else {
    // 更新既有列
    headers.forEach((h, colIdx) => {
      if (h === 'tripId') return;
      if (updateData[h] !== undefined) {
        sheet.getRange(rowIndex, colIdx + 1).setValue(String(updateData[h]));
      }
    });
  }
  SpreadsheetApp.flush();
  return { status: 'success', message: '更新旅程資訊成功' };
}

