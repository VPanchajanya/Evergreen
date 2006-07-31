var holdsOrgSelectorBuilt = false;
var holdArgs;

/* 
note: metarecord holds have a holdable_formats field that contains
item_type(s)-item_forms(s)-language
item_form and language are optional - if language exist and no 
item_form is specified, use item_type(s)--language
*/

function holdsHandleStaff() {
	swapCanvas($('xulholds_box'));
	$('xul_recipient_barcode').focus();
	$('xul_recipient_barcode').onkeypress = function(evt) 
		{if(userPressedEnter(evt)) { _holdsHandleStaff(); } };
	$('xul_recipient_barcode_submit').onclick = _holdsHandleStaff;
	$('xul_recipient_me').onclick = _holdsHandleStaffMe;
}

function _holdsHandleStaffMe() {
	holdArgs.recipient = G.user;
	holdsDrawEditor();
}

function _holdsHandleStaff() {
	var barcode = $('xul_recipient_barcode').value;
	var user = grabUserByBarcode( G.user.session, barcode );
	if(!user) {
		alert('fixme: invalid user barcode: ['+barcode+']');
		return
	}
	holdArgs.recipient = user;
	holdsDrawEditor();
}



/** args:
  * record, volume, copy (ids)
  * request, recipient, editHold (objects)
  */

function holdsDrawEditor(args) {

	holdArgs = (args) ? args : holdArgs;

	if(isXUL() && holdArgs.recipient == null 
			&& holdArgs.editHold == null) {
		holdsHandleStaff();
		return;
	}

	if(!holdArgs.recipient) holdArgs.recipient = G.user;
	if(!holdArgs.requestor) holdArgs.requestor = G.user;

	if(!(holdArgs.requestor && holdArgs.requestor.session)) {
		detachAllEvt('common','locationChanged');
		attachEvt('common','loggedIn', holdsDrawEditor)
		initLogin();
		return;
	}

	if(holdArgs.editHold) // flesh the args with the existing hold 
		holdArgsFromHold(holdArgs.editHold, holdArgs);

	holdsDrawWindow();
}


// updates the edit window with the existing hold's data 
function _holdsUpdateEditHold() {

	var hold = holdArgs.editHold;
	var status = holdArgs.status;

	var orgsel = $('holds_org_selector');
	setSelector(orgsel, hold.pickup_lib());

	if( hold.capture_time() || status > 2 )
		orgsel.disabled = true;
	else	
		orgsel.disabled = false;


	$('holds_submit').onclick = holdsEditHold;
	$('holds_update').onclick = holdsEditHold;

	if(hold.phone_notify()) {
		$('holds_enable_phone').checked = true;
		$('holds_phone').value = hold.phone_notify();

	} else {
		$('holds_phone').disabled = true;
		$('holds_enable_phone').checked = false;
	}

	if(hold.email_notify()) {
		$('holds_enable_email').checked = true;

	} else {
		$('holds_enable_email').checked = false;
	}
}

function holdsEditHold() {
	var hold = holdsBuildHoldFromWindow();
	if(!hold) return;
	holdsUpdate(hold);
	showCanvas();
	if(holdArgs.onComplete)
		holdArgs.onComplete(hold);
}

function holdArgsFromHold(hold, oargs) {
	var args = (oargs) ? oargs : {};
	args.type = hold.hold_type();
	var target = hold.target();

	switch(args.type) {
		case 'M':
			args.metarecord = target;
			break;
		case 'T':
			args.record = target;
			break;
		case 'V':
			args.volume = target;
			break;
		case 'C':
			args.copy = target;
			break;
	}
	return args;
}

function holdFetchObjects(hold, doneCallback) {

	var args = (hold) ? holdArgsFromHold(hold) : holdArgs;

	var type = args.type;

	if( type == 'C' ) {

		if( args.copyObject ) {

			args.copy = args.copyObject.id();
			args.volume = args.copyObject.call_number();
			_h_set_vol(args, doneCallback);

		} else {
			var creq = new Request(FETCH_COPY, args.copy);

			creq.callback(
				function(r) {
					var cp = r.getResultObject();
					args.copyObject = cp;
					args.volume = args.copyObject.call_number();
					_h_set_vol(args, doneCallback);
				}
			);
			creq.send();
		}
	} else {
		if( type == 'V' ) {
			_h_set_vol(args, doneCallback);

		} else {
			if( type == 'T' ) {
				_h_set_rec(args, doneCallback);
			} else {
				_h_set_rec_descriptors(args, doneCallback);
			}
		}
	}

	return args;
}

function _h_set_vol(args, doneCallback) {

	if( args.volumeObject ) {
		args.volume = args.volumeObject.id();
		args.record = args.volumeObject.record();
		_h_set_rec(args, doneCallback);

	} else {

		var vreq = new Request(FETCH_VOLUME, args.volume);
		vreq.callback(
			function(r) {
				var vol = r.getResultObject();
				args.volumeObject = vol;
				args.record = vol.record();
				_h_set_rec(args, doneCallback);
			}
		);
		vreq.send();
	}
}

function _h_set_rec(args, doneCallback) {

	if(args.recordObject) 
		args.record = args.recordObject.doc_id();
	else 
		args.recordObject = findRecord( args.record, 'T' );
	
	if( args.type == 'T' || args.type == 'M' ) 
		_h_set_rec_descriptors(args, doneCallback);
	else 
		if(doneCallback) doneCallback(args);
}


function _h_set_rec_descriptors(args, doneCallback) {

	// grab the list of record desciptors attached to this records metarecord 
	if( ! args.recordDescriptors )  {
		var params = { record: args.record };

		if( ! args.record ) {
			if( args.metarecord )
				params = { metarecord : args.metarecord };
			else 
				params = { metarecord : args.metarecordObject.doc_id() };
		}

		var req = new Request(FETCH_MR_DESCRIPTORS, params );
		req.callback(
			function(r) {
				var data = r.getResultObject();
				args.recordDescriptors = data.descriptors;
				args.metarecord = data.metarecord;
				if( args.type == 'M' && ! args.metarecordObject) 
					args.metarecordObject = findRecord(args.metarecord, 'M');	
				 
				if(doneCallback) doneCallback(args);
			}
		);
		req.send();

	} else {
		if(doneCallback) doneCallback(args);
	}

	return args;
}



function holdsDrawWindow() {
	swapCanvas($('holds_box'));
	$('holds_cancel').onclick = function(){ runEvt('common', 'holdUpdateCanceled'), showCanvas() };
	$('holds_submit').onclick = function(){holdsPlaceHold(holdsBuildHoldFromWindow())};
	$('holds_update').onclick = function(){holdsPlaceHold(holdsBuildHoldFromWindow())};
	holdFetchObjects(null, 
		function(){
			__holdsDrawWindow();

			if(holdArgs.editHold) {
				hideMe($('holds_submit'));
				unHideMe($('holds_update'));
				var req = new Request(FETCH_HOLD_STATUS, 
					G.user.session, holdArgs.editHold.id());
				req.send(true);
				holdArgs.status = req.result();
				_holdsUpdateEditHold();
			}  
		}
	);
}

function __holdsDrawWindow() {

	var rec = holdArgs.recordObject;
	var vol = holdArgs.volumeObject;
	var copy = holdArgs.copyObject;
	var mr = holdArgs.metarecordObject;

	rec = (rec) ? rec : mr;

	if(!holdsOrgSelectorBuilt) {
		holdsBuildOrgSelector(null,0);
		holdsOrgSelectorBuilt = true;
		var selector = $('holds_org_selector');

		/*
		var o_loc = findOrgUnit(getOrigLocation());
		var t = findOrgType(o_loc.ou_type());
		if( t.can_have_users() ) 
			setSelector(selector, o_loc.id());
		else 
		*/

		setSelector(selector, holdArgs.recipient.home_ou());
	
	}

	/*
	if(isXUL()) {
		var dsel = $('holds_depth_selector');
		unHideMe($('holds_depth_selector_row'));
		if(dsel.getElementsByTagName('option').length == 0) {
			var types = globalOrgTypes;
			var depth = findOrgDepth(G.user.ws_ou());
			iterate(types, 
				function(t) {
					if(t.depth() > depth) return;
					insertSelectorVal(dsel, -1, t.opac_label(), t.depth());
				}
			);
		}
	}
	*/

	appendClear($('holds_recipient'), text(
		holdArgs.recipient.family_name() + ', ' +  
			holdArgs.recipient.first_given_name()));
	appendClear($('holds_title'), text(rec.title()));
	appendClear($('holds_author'), text(rec.author()));

	if( holdArgs.type == 'V' || holdArgs.type == 'C' ) {

		unHideMe($('holds_type_row'));
		unHideMe($('holds_cn_row'));
		appendClear($('holds_cn'), text(holdArgs.volumeObject.label()));

		if( holdArgs.type == 'V'  ) {
			unHideMe($('holds_is_cn'));
			hideMe($('holds_is_copy'));

		} else {
			hideMe($('holds_is_cn'));
			unHideMe($('holds_is_copy'));
			unHideMe($('holds_copy_row'));
			appendClear($('holds_copy'), text(holdArgs.copyObject.barcode()));
		}

	} else {
		hideMe($('holds_type_row'));
		hideMe($('holds_copy_row'));
		hideMe($('holds_cn_row'));
	}

	removeChildren($('holds_format'));

	var mods_formats = rec.types_of_resource();
	var formats;

	if(holdArgs.recordDescriptors)
		formats = holdArgs.recordDescriptors[0].item_type();

	if( holdArgs.type == 'T' ) {
		var desc = grep( holdArgs.recordDescriptors,
			function(i) {
				return (i.record() == holdArgs.record);	
			}
		);
		formats = desc[0].item_type();
	}

	if( holdArgs.type == 'M' ) {
		var data = holdsParseMRFormats(holdArgs.editHold.holdable_formats());
		mods_formats = data.mods_formats;
		formats = data.formats;
	}


	for( var i in mods_formats ) {
		var res = mods_formats[i];
		var img = elem("img");
		setResourcePic(img, res);
		$('holds_format').appendChild(img);
		if(formats)
			$('holds_format').appendChild(text(' '+ MARCTypeToFriendly(formats[i]) +' '));
		else
			$('holds_format').appendChild(text(' '+ mods_formats[i] +' '));
		$('holds_format').appendChild(elem('br'));
	}


	$('holds_phone').value = holdArgs.recipient.day_phone();
	appendClear( $('holds_email'), text(holdArgs.recipient.email()));

	var pref = G.user.prefs[PREF_HOLD_NOTIFY];

	if(pref) {
		if( ! pref.match(/email/i) ) 
			$('holds_enable_email').checked = false;

		if( ! pref.match(/phone/i) ) {
			$('holds_phone').disabled = true;
			$('holds_enable_phone').checked = false;
		}
	}

	if(!$('holds_phone').value) 
		$('holds_enable_phone').checked = false;	

	appendClear($('holds_physical_desc'), text(rec.physical_description()));

	if(holdArgs.type == 'M') hideMe($('hold_physical_desc_row'));

	holdsSetFormatSelector();
}

function holdsParseMRFormats(str) {
	var data = str.split(/-/);	

	var formats = [];
	var mods_formats = [];

	for( var i = 0; i < data[0].length; i++ ) {
		formats.push( data[0].charAt(i) );
		mods_formats.push( MARCFormatToMods( formats[i] ) );
	}
	
	formats = uniquify(formats);
	mods_formats = uniquify(mods_formats);

	return {
		formats			: formats,
		mods_formats	: mods_formats,
		lang				: data[2],
		largeprint		: data[1]
	};
}


function holdsSetFormatSelector() {
	var type = holdArgs.type;
	if( type == 'C' || type == 'V' || holdArgs.editHold ) return;

	var data				= holdsGetFormats();
	var avail_formats	= data.avail_formats;
	var sel_formats	= data.sel_formats;
	holdArgs.language = data.lang;

	unHideMe($('holds_alt_formats_row_extras'));
	var selector = $('hold_alt_form_selector');

	for( var i = 0; i < avail_formats.length; i++ ) {
		var form = avail_formats[i];
		unHideMe(findSelectorOptByValue(selector, form));
	}
}


function holdsGetFormats() {

	var lang;
	var formats = [];
	var sformats = []; // selected formats 

	var type = holdArgs.type;
	var desc = holdArgs.recordDescriptors;
	var rec	= holdArgs.record;
	var mrec = holdArgs.metarecord;

	if( type == 'T' ) {

		for( var i = 0; i < desc.length; i++ ) {
			var d = desc[i];
			if( d.record() == holdArgs.record ) {
				lang = d.item_lang();
				holdArgs.myFormat =  _t_f_2_format(d.item_type(), d.item_form());
				sformats.push(holdArgs.myFormat);
				break;
			}
		}
	}

	for( var i = 0; i < desc.length; i++ ) {
		var d = desc[i];
		if( d.item_lang() != lang ) continue;
		formats.push( _t_f_2_format(d.item_type(), d.item_form()));
	}

	formats = uniquify(formats);

	return {
		lang : lang,
		avail_formats : formats, 
		sel_formats : sformats
	};
}



function _t_f_2_format(type, form) {
	if( form == 'd' ) return 'at-d';
	return (type == 'a' || type == 't') ? 'at' : 
		( type == 'i' || type == 'g' || type == 'j' ) ? type : null;
}

function holdsSetSelectedFormats() {

	var cn = $('holds_alt_formats_row').className;
	if( cn && cn.match(/hide_me/) ) return;

	var selector = $('hold_alt_form_selector');
	var vals = getSelectedList(selector);

	if(vals.length == 0) return;

	var fstring = "";

	if( contains(vals, 'at-d') ) {
		if( contains(vals, 'at') )
			fstring = 'at';
		else 
			fstring = 'at-d';
	} else {
		if( contains(vals, 'at') )
			fstring = 'at';
	}

	for( var i = 0; i < vals.length; i++ ) {
		var val = vals[i];
		if( !val.match(/at/) ) fstring = val + fstring;
	}

	if( holdArgs.language ) {
		if( fstring.match(/-/) )
			fstring = fstring + '-' + holdArgs.language;
		else
			fstring = fstring + '--' + holdArgs.language;
	}


	return fstring;
}


function holdsCheckPossibility(pickuplib) {
	var rec = holdArgs.record;
	var type = holdArgs.type;
	var req = new Request(CHECK_HOLD_POSSIBLE, G.user.session, 
			{ titleid : rec, patronid : G.user.id(), depth : 0, pickup_lib : pickuplib } );
	req.request.alertEvent = false;
	req.send(true);
	return req.result();
}


function holdsBuildOrgSelector(node) {

	if(!node) node = globalOrgTree;

	var selector = $('holds_org_selector');
	var index = selector.options.length;

	var type = findOrgType(node.ou_type());
	var indent = type.depth() - 1;
	var opt = setSelectorVal( selector, index, node.name(), node.id(), null, indent );
	if(!type.can_have_users()) {
		opt.disabled = true;
		addCSSClass(opt, 'disabled_option');
	}
	
	for( var i in node.children() ) {
		var child = node.children()[i];
		if(child) holdsBuildOrgSelector(child);
	}
}

function holdsBuildHoldFromWindow() {

	var org = getSelectorVal($('holds_org_selector'));
	var node = findOrgUnit(org);
	var ntype = findOrgType(node.ou_type());
	if(!ntype.can_have_users()) {
		alertId('holds_pick_good_org');
		return;
	}

	var hold = new ahr();
	if(holdArgs.editHold) {
		hold = holdArgs.editHold;
		holdArgs.editHold = null;
	}

	if( $('holds_enable_phone').checked ) {
		var phone = $('holds_phone').value;
		if( !phone || !phone.match(REGEX_PHONE) ) {
			alert($('holds_bad_phone').innerHTML);
			return null;
		}
		hold.phone_notify(phone);

	} else {
		hold.phone_notify("");
	}

	if( $('holds_enable_email').checked ) 
		hold.email_notify(1);
	else
		hold.email_notify(0);

	var target;

	switch(holdArgs.type) {
		case 'M':
			target = holdArgs.metarecord; break;
		case 'T':
			target = holdArgs.record; break;
		case 'V':
			target = holdArgs.volume; break;
		case 'C':
			target = holdArgs.copy; break;
	}



	hold.pickup_lib(org); 
	hold.request_lib(org); 
	hold.requestor(holdArgs.requestor.id());
	hold.usr(holdArgs.recipient.id());
	hold.target(target);
	hold.hold_type(holdArgs.type);

	//check for alternate hold formats 
	var fstring = holdsSetSelectedFormats();
	if(fstring) { 
		hold.hold_type('M'); 
		hold.holdable_formats(fstring);
		hold.target(holdArgs.metarecord);
	}

	//alert(fstring); return;

	/*
	if(isXUL())		
		hold.selection_depth(getSelectorVal($('holds_depth_selector')));
		*/

	return hold;
}
	
function holdsPlaceHold(hold, recurse) {

	if(!hold) return;

	swapCanvas($('check_holds_box'));

	if( holdArgs.type == 'M' || holdArgs.type == 'T' ) {
		var res = holdsCheckPossibility(hold.pickup_lib());
		if(!res || checkILSEvent(res) ) {
			if(!res) {
				alert($('hold_not_allowed').innerHTML);
			} else {
				if( res.textcode == 'PATRON_BARRED' ) {
					alertId('hold_failed_patron_barred');
				} else {
					alert($('hold_not_allowed').innerHTML);
				}
			}
			swapCanvas($('holds_box'));
			return;
		}
	}

	var method = CREATE_HOLD;
	if(recurse) method = CREATE_HOLD_OVERRIDE;

	var req = new Request( method, holdArgs.requestor.session, hold );
	req.request.alertEvent = false;
	req.send(true);
	var res = req.result();
	holdProcessResult(hold, res, recurse);
	
	showCanvas();

	holdArgs = null;
	runEvt('common', 'holdUpdated');
}

function holdProcessResult( hold, res, recurse ) {

	if( res == '1' ) {
		alert($('holds_success').innerHTML);

	} else {

		if( recurse ) {
			alert($('holds_failure').innerHTML);
			return;
		}

		if( grep(res, function(e) { return (e.textcode == 'HOLD_EXISTS'); }) ) {

			/* see if the requestor has the ability to create duplicate holds */
			var preq = new Request(FETCH_HIGHEST_PERM_ORG, 
				G.user.session, G.user.id(), ['CREATE_DUPLICATE_HOLDS']);
			preq.send(true);
			var org = preq.result()[0];

			if( org ) {
				if( confirm($('hold_dup_exists_override').innerHTML) ) {
					holdsPlaceHold(hold, true);
				}

			} else {
				alert($('hold_dup_exists').innerHTML);
				return;
			}
		}
	}
}


function holdsCancel(holdid, user) {
	if(!user) user = G.user;
	var req = new Request(CANCEL_HOLD, user.session, holdid);
	req.send(true);
	return req.result();
	runEvt('common', 'holdUpdated');
}

function holdsUpdate(hold, user) {
	if(!user) user = G.user;
	var req = new Request(UPDATE_HOLD, user.session, hold);
	req.send(true);
	var x = req.result(); // cause an exception if there is one 
	runEvt('common', 'holdUpdated');
}


