/**
 * A bookmarklet that fills a directory's signup form from the saved record.
 *
 * Sixty of the directories on the list have no write API, so a person fills
 * the form. That person is not slow because clicking is slow - they are slow
 * because they are retyping the same eleven fields for the sixtieth time, and
 * every retype is a chance for listing forty to say "Ste" where listing twelve
 * said "Suite". The inconsistency costs more ranking than the citation gains.
 *
 * So the typing is automated and nothing else is. The bookmarklet fills the
 * visible inputs and stops:
 *
 *  - It never submits. The person reviews and clicks.
 *  - It never touches a CAPTCHA, and nothing here tries to look human.
 *  - It skips password, hidden and file inputs, and anything already filled,
 *    so it cannot overwrite a value the person typed.
 *
 * The record is baked into the bookmarklet rather than fetched, because a
 * bookmarklet running on someone else's domain cannot read our API - the
 * browser blocks it - and because a fetch would mean shipping a credential
 * into a page we do not control.
 */

/**
 * Field patterns, most specific first. Each entry maps a value from the record
 * to the ways forms name that field.
 *
 * Order matters: 'business name' has to be tried before 'name', or the pattern
 * for a person's name claims the business name input. Likewise 'postal' before
 * 'code', and 'website' before 'url'.
 */
const FIELD_RULES = [
  { key: 'email', patterns: ['email', 'e-mail'], type: 'email' },
  { key: 'phone', patterns: ['phone', 'telephone', 'tel', 'mobile', 'contact number'], type: 'tel' },
  { key: 'website', patterns: ['website', 'web site', 'weburl', 'site url', 'homepage', 'www'] },
  { key: 'logo', patterns: ['logo', 'image url', 'photo url'] },
  { key: 'name', patterns: ['business name', 'company name', 'businessname', 'companyname', 'organisation', 'organization', 'listing name', 'store name', 'trade name'] },
  { key: 'street', patterns: ['street', 'address line 1', 'address1', 'addr1', 'address'] },
  { key: 'city', patterns: ['city', 'town', 'locality', 'suburb'] },
  { key: 'state', patterns: ['state', 'province', 'region', 'county'] },
  { key: 'postalCode', patterns: ['postal', 'postcode', 'zip'] },
  { key: 'description', patterns: ['description', 'about', 'summary', 'bio', 'details', 'overview'], long: true },
  { key: 'categories', patterns: ['category', 'categories', 'industry', 'sector'] },
  { key: 'services', patterns: ['service', 'services', 'keywords', 'tags', 'specialit', 'specialt'] },
  { key: 'hours', patterns: ['hours', 'opening', 'business hours'] },
  { key: 'country', patterns: ['country'] },
  { key: 'facebook', patterns: ['facebook'] },
  { key: 'instagram', patterns: ['instagram'] },
  { key: 'linkedin', patterns: ['linkedin'] },
  { key: 'pinterest', patterns: ['pinterest'] },
  { key: 'youtube', patterns: ['youtube'] }
];

/**
 * Flattens a profile into the values the rules above refer to.
 *
 * @param {object} profile  From napProfile.buildProfile.
 * @returns {Record<string, string>}
 */
const flatten = (profile) => {
  const social = profile.social || {};

  const values = {
    name: profile.name,
    // Dashed is what most forms accept; the page's own validation usually
    // reformats it, and a wrong format is easier to spot than a wrong number.
    phone: profile.phone.dashed,
    street: profile.address.street,
    city: profile.address.city,
    state: profile.address.state,
    postalCode: profile.address.postalCode,
    country: 'United States',
    email: profile.email,
    website: profile.website,
    logo: profile.logo,
    description: profile.description[500] || profile.description.full,
    categories: (profile.categories || []).join(', '),
    services: (profile.services || []).join(', '),
    hours: profile.hours,
    facebook: social.facebook || '',
    instagram: social.instagram || '',
    linkedin: social.linkedin || '',
    pinterest: social.pinterest || '',
    youtube: social.youtube || ''
  };

  // A short description for fields that cap tightly. The bookmarklet picks
  // between them by maxlength.
  values.descriptionShort = profile.description[160] || '';

  for (const k of Object.keys(values)) {
    if (!values[k]) delete values[k];
  }

  return values;
};

/**
 * The bookmarklet body. Written as a plain string rather than a function so it
 * can be minified into a javascript: URL without a build step.
 *
 * It is deliberately conservative: an input is only filled when a rule matches
 * something the form itself says about that input, and never when the person
 * has already typed there.
 */
const SCRIPT = `(function(){
var V=__VALUES__,R=__RULES__;

function labelText(el){
  var t='';
  if(el.id){
    var l=document.querySelector('label[for="'+CSS.escape(el.id)+'"]');
    if(l)t+=' '+l.textContent;
  }
  var p=el.closest('label');
  if(p)t+=' '+p.textContent;
  return t;
}

// Everything the form says about this input, lowercased. A rule matches on
// any of it, because forms are inconsistent about which one carries meaning.
function haystack(el){
  return [el.name,el.id,el.placeholder,el.getAttribute('aria-label'),
          el.getAttribute('data-name'),labelText(el)]
         .filter(Boolean).join(' ').toLowerCase();
}

function fillable(el){
  if(el.disabled||el.readOnly)return false;
  // Invisible inputs are usually a hidden step of the form, not this one.
  if(el.offsetParent===null&&el.type!=='hidden')return false;
  var t=(el.type||'').toLowerCase();
  if(['hidden','password','file','submit','button','image','checkbox','radio','range','color'].indexOf(t)>=0)return false;
  // Never overwrite something already typed.
  return !String(el.value||'').trim();
}

function setValue(el,val){
  var proto=el instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
  var setter=Object.getOwnPropertyDescriptor(proto,'value').set;
  // Through the native setter, so React and other frameworks see the change
  // instead of overwriting it on the next render.
  setter.call(el,val);
  el.dispatchEvent(new Event('input',{bubbles:true}));
  el.dispatchEvent(new Event('change',{bubbles:true}));
}

var filled=0;
var els=document.querySelectorAll('input,textarea');

for(var i=0;i<els.length;i++){
  var el=els[i];
  if(!fillable(el))continue;
  var hay=haystack(el);
  if(!hay)continue;

  for(var r=0;r<R.length;r++){
    var rule=R[r],hit=false;
    for(var p=0;p<rule.patterns.length;p++){
      if(hay.indexOf(rule.patterns[p])>=0){hit=true;break;}
    }
    if(!hit)continue;

    var val=V[rule.key];
    if(!val)break;

    // Respect the field's own limit rather than letting it silently chop.
    var max=parseInt(el.getAttribute('maxlength'),10);
    if(rule.key==='description'&&max&&max<val.length&&V.descriptionShort&&V.descriptionShort.length<=max){
      val=V.descriptionShort;
    }
    if(max&&val.length>max){
      var cut=val.slice(0,max),sp=cut.lastIndexOf(' ');
      val=sp>max*0.6?cut.slice(0,sp):cut;
    }

    // A single-line input should not receive a paragraph.
    if(rule.long&&el.tagName==='INPUT'&&!max&&val.length>200){
      val=V.descriptionShort||val.slice(0,200);
    }

    setValue(el,val);
    el.style.outline='2px solid #2563eb';
    filled++;
    break;
  }
}

var msg=document.createElement('div');
msg.textContent=filled?('Filled '+filled+' field'+(filled===1?'':'s')+' - check them, then submit'):'No matching fields found on this page';
msg.setAttribute('style','position:fixed;z-index:2147483647;left:50%;top:18px;transform:translateX(-50%);background:#0f172a;color:#fff;font:600 14px system-ui,sans-serif;padding:11px 18px;border-radius:10px;box-shadow:0 8px 28px rgba(0,0,0,.35)');
document.body.appendChild(msg);
setTimeout(function(){msg.remove();},4200);
})();`;

/**
 * Builds the bookmarklet for one business.
 *
 * @param {object} profile  From napProfile.buildProfile.
 * @returns {{href: string, values: object, fieldCount: number}}
 */
const buildBookmarklet = (profile) => {
  const values = flatten(profile);

  const rules = FIELD_RULES.map(r => ({
    key: r.key,
    patterns: r.patterns,
    ...(r.long ? { long: true } : {})
  }));

  // A javascript: URL is one line, so every comment has to go before the
  // newlines do. Only whole-line comments are removed - a trailing one would
  // swallow the rest of the line when it collapsed, which is a silent break
  // that only shows up as a bookmarklet that does nothing. Guard rather than
  // try to strip them, since "//" also appears inside every URL here.
  const inlineComment = SCRIPT.split('\n').find(
    line => /\S/.test(line.split('//')[0]) && /(^|[^:])\/\//.test(line)
  );

  if (inlineComment) {
    throw new Error(`autofill: trailing comment would break the bookmarklet: ${inlineComment.trim()}`);
  }

  const body = SCRIPT
    .replace('__VALUES__', JSON.stringify(values))
    .replace('__RULES__', JSON.stringify(rules))
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\s*\n\s*/g, '');

  return {
    href: 'javascript:' + encodeURIComponent(body),
    values,
    fieldCount: Object.keys(values).length
  };
};

module.exports = { buildBookmarklet, flatten, FIELD_RULES, SCRIPT };
