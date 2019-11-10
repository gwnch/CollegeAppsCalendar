// creates new menu option
function onOpen() {
  var menu = [{name: 'Create form', functionName: 'selectColleges_'}];
  SpreadsheetApp.getActive().addMenu('Colleges', menu);
}

// initializes calendar, docs, and sheet
function selectColleges_() {
  if (ScriptProperties.getProperty('calId')) {
    Browser.msgBox('Your colleges have been selected. Check your Google Drive!');
  }
  var ss = SpreadsheetApp.getActive();
  var sheet = ss.getSheetByName('Regular Deadlines');
  var range = sheet.getDataRange();
  var values = range.getValues();
  setUpCalendar_(values, range);
  setUpForm_(ss, values);
  ScriptApp.newTrigger('onFormSubmit').forSpreadsheet(ss).onFormSubmit()
      .create();
  ss.removeMenu('Colleges');
}

// setting up calendar event
function setUpCalendar_(values, range) {
  var cal = CalendarApp.createCalendar('College Calendar');
  for (var i = 1; i < values.length; i++) {
    var session = values[i];
    var title = session[0];
    var start = joinDateAndTime_(session[1], session[2]);
    var end = joinDateAndTime_(session[1], session[3]);
    var options = {location: session[4], sendInvites: true};
    var event = cal.createEvent(title, start, end, options)
        .setGuestsCanSeeGuests(false);
    session[5] = event.getId();
  }
  range.setValues(values);

  // store the ID for the Calendar, which is needed to retrieve events by ID.
  ScriptProperties.setProperty('calId', cal.getId());
}

// sends calendar invite
function onFormSubmit(e) {
  var user = {name: e.namedValues['Name'][0], email: e.namedValues['Email'][0]};

  // Grab the session data again so that we can match it to the user's choices.
  var response = [];
  var values = SpreadsheetApp.getActive().getSheetByName('College Events Calendar')
     .getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    var session = values[i];
    var title = session[0];
    var day = session[1].toLocaleDateString();
    var time = session[2].toLocaleTimeString();
    var timeslot = time + ' ' + day;

    // For every selection in the response, find the matching timeslot and title
    // in the spreadsheet and add the session data to the response array.
    if (e.namedValues[timeslot] && e.namedValues[timeslot] == title) {
      response.push(session);
    }
  }
  sendInvites_(user, response);
  sendDoc_(user, response);
}

// invite user to calendar event
function sendInvites_(user, response) {
  var id = ScriptProperties.getProperty('calId');
  var cal = CalendarApp.getCalendarById(id);
  for (var i = 0; i < response.length; i++) {
    cal.getEventSeriesById(response[i][5]).addGuest(user.email);
  }
}

// creates doc with dates and events listed
function sendDoc_(user, response) {
  var doc = DocumentApp.create('Conference Itinerary for ' + user.name)
      .addEditor(user.email);
  var body = doc.getBody();
  var table = [['Session', 'Date', 'Time', 'Location']];
  for (var i = 0; i < response.length; i++) {
    table.push([response[i][0], response[i][1].toLocaleDateString(),
        response[i][2].toLocaleTimeString(), response[i][4]]);
  }
  body.insertParagraph(0, doc.getName())
      .setHeading(DocumentApp.ParagraphHeading.HEADING1);
  table = body.appendTable(table);
  table.getRow(0).editAsText().setBold(true);
  doc.saveAndClose();

  // email a link to the Doc as well as a PDF copy.
  MailApp.sendEmail({
    to: user.email,
    subject: doc.getName(),
    body: 'Thanks for registering! Here\'s your itinerary: ' + doc.getUrl(),
    attachments: doc.getAs(MimeType.PDF)
  });
}
