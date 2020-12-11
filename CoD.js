const input = args.widgetParameter

const userRe = /(?:[a-z0-9!#$%&'*+\/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+\/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/

const username = userRe.exec(input)[0]
const passwordRe = /(\@(.*)\|(.*))/
const password = passwordRe.exec(input)[3]
  
async function getCSRF() {
  const url = 'https://profile.callofduty.com/cod/login'
  const r = new Request(url)
  await r.load()
  const csrf = r.response.cookies.find( ({ name }) => name === 'XSRF-TOKEN' ).value;
  return csrf
}

async function getLogin(token) {
  const url = 'https://profile.callofduty.com/do_login?new_SiteId=cod'
  const r = new Request(url)
  r.method = 'POST'
  r.addParameterToMultipart('username', username)
  r.addParameterToMultipart('password', password)
  r.addParameterToMultipart('remember_me', 'true')
  r.addParameterToMultipart('_csrf', token)
  r.headers = {Cookie: `XSRF-TOKEN=${token}; new_SiteId=cod;`}
  await r.load()
  const ACT_SSO_COOKIE = r.response.cookies.find( ({ name }) => name === 'ACT_SSO_COOKIE' ).value
  const ACT_SSO_COOKIE_EXPIRY = r.response.cookies.find( ({ name }) => name === 'ACT_SSO_COOKIE_EXPIRY' ).value
  const atkn = r.response.cookies.find( ({ name }) => name === 'atkn' ).value
  const authHeaders = `ACT_SSO_COOKIE=${ACT_SSO_COOKIE}; ACT_SSO_COOKIE_EXPIRY=${ACT_SSO_COOKIE_EXPIRY}; atkn=${atkn};`
  return authHeaders;
}

async function getFriends(csrf, authHeaders) {
  const url = `https://my.callofduty.com/api/papi-client/userfeed/v1/friendFeed/rendered/en/${csrf}`;
  const r = new Request(url);
  r.headers = {Cookie: authHeaders};
  const players = await r.loadJSON();
  const friends = players.data.identities
  const onlineFriends = friends.filter(f => f.status.online === true).map(f => f.username.split('#')[0])
  if (onlineFriends.length === 0) {
    onlineFriends.push('No friends on')
  }
  return onlineFriends;
}

function formatAMPM(date) {
  let hours = date.getHours();
  let minutes = date.getMinutes();
  let ampm = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  minutes = minutes < 10 ? '0'+minutes : minutes;
  let strTime = hours + ':' + minutes + ' ' + ampm;
  return strTime;
}

async function generateResponse() {
  const response = {}
  response.widget = new ListWidget();
  const now = await new Date(Date.now());
  const time = `Last run: ${formatAMPM(now)}`;
  const csrf = await getCSRF();
  const authHeaders = await getLogin(csrf);
  const onlineFriends = await getFriends(csrf, authHeaders);
  onlineFriends.map(f => response.widget.addText(f))
  
  console.log(onlineFriends);
  console.log(response)
  
  response.widget.addText("")
  
  let dateText = response.widget.addText(time)
  dateText.font = Font.semiboldSystemFont(11)
  dateText.rightAlignText()
  dateText.textColor  = Color.lightGray()
  
  let gradient = new LinearGradient()
  gradient.locations = [0, 1]
  gradient.colors = [
    new Color("13233F"),
    new Color("141414")
  ]
  response.widget.backgroundGradient = gradient
  
  return response
}

// TODO figure out how to have siri say "yes people online" or "nobody on" and then show the message of who is online or nobody on

const presentation = await generateResponse();

// Script.setWidget(widget);

if (config.runsInWidget) {
  // The script runs inside a widget, so we pass our instance of ListWidget to be shown inside the widget on the Home Screen.
  Script.setWidget(presentation.widget)
} else {
  // The script runs inside the app, so we preview the widget.
  presentation.widget.presentSmall()
}

Script.complete();
