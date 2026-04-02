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

  // 4. 回傳
  return {
    tripId: trip.tripId,
    name:   trip.name,
    startDate: trip.startDate,
    endDate:   trip.endDate,
    coverUrl:  trip.coverUrl,
    journeys,
  };
}
