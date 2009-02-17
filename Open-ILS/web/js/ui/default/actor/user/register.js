dojo.require('dojo.data.ItemFileReadStore');
dojo.require('dijit.form.Textarea');
dojo.require('dijit.form.FilteringSelect');
dojo.require('dijit.form.ComboBox');
dojo.require('fieldmapper.IDL');
dojo.require('openils.PermaCrud');
dojo.require('openils.widget.AutoGrid');
dojo.require('openils.widget.AutoFieldWidget');
dojo.require('dijit.form.CheckBox');

var pcrud;
var fmClasses = ['au', 'ac', 'aua', 'actsc', 'asv', 'asvq', 'asva'];
var fieldDoc = {};
var statCats;
var statCatTempate;
var surveys;
var staff;


function load() {
    staff = new openils.User().user;
    pcrud = new openils.PermaCrud();

    var list = pcrud.search('fdoc', {fm_class:fmClasses});
    for(var i in list) {
        var doc = list[i];
        if(!fieldDoc[doc.fm_class()])
            fieldDoc[doc.fm_class()] = {};
        fieldDoc[doc.fm_class()][doc.field()] = doc;
    }

    statCats = fieldmapper.standardRequest(
        ['open-ils.circ', 'open-ils.circ.stat_cat.actor.retrieve.all'],
        {params : [openils.User.authtoken, staff.ws_ou()]}
    );

    surveys = fieldmapper.standardRequest(
        ['open-ils.circ', 'open-ils.circ.survey.retrieve.all'],
        {params : [openils.User.authtoken]}
    );

    loadTable();
}

function loadTable() {
    var tbody = dojo.byId('uedit-tbody');
    for(var idx = 0; tbody.childNodes[idx]; idx++) {
        var row = tbody.childNodes[idx];
        if(row.nodeType != row.ELEMENT_NODE) continue;
        var fmcls = row.getAttribute('fmclass');
        if(!fmcls) continue;
        fleshFMRow(row, fmcls);
    }

    statCatTemplate = tbody.removeChild(dojo.byId('stat-cat-row-0'));

    for(var idx in statCats) {
        var stat = statCats[idx];
        var row = statCatTemplate.cloneNode(true);
        row.id = 'stat-cat-row-' + idx;
        tbody.insertBefore(row, dojo.byId('survey-cat-divider'));
        dojo.query('[name=name]', row)[0].innerHTML = stat.name();
        var valtd = dojo.query('[name=widget]', row)[0];
        var span = valtd.appendChild(document.createElement('span'));
        var store = new dojo.data.ItemFileReadStore(
                {data:fieldmapper.actsc.toStoreData(stat.entries())});
        var comboBox = new dijit.form.ComboBox({store:store}, span);
        comboBox.labelAttr = 'value';
        comboBox.searchAttr = 'value';
    }
}


function fleshFMRow(row, fmcls) {
    var fmfield = row.getAttribute('fmfield');
    var wclass = row.getAttribute('wclass');
    var wstyle = row.getAttribute('wstyle');
    var fieldIdl = fieldmapper.IDL.fmclasses[fmcls].field_map[fmfield];

    var existing = dojo.query('td', row);
    var htd = existing[0] || row.appendChild(document.createElement('td'));
    var ltd = existing[1] || row.appendChild(document.createElement('td'));
    var wtd = existing[2] || row.appendChild(document.createElement('td'));

    openils.Util.addCSSClass(htd, 'uedit-help');
    if(fieldDoc[fmcls] && fieldDoc[fmcls][fmfield]) {
        var link = dojo.byId('uedit-help-template').cloneNode(true);
        link.id = '';
        link.setAttribute('href', 'javascript:ueLoadContextHelp("'+fmcls+'","'+fmfield+'")');
        openils.Util.removeCSSClass(link, 'hidden');
        htd.appendChild(link);
    }

    if(!ltd.textContent) {
        var span = document.createElement('span');
        ltd.appendChild(document.createTextNode(fieldIdl.label));
    }

    span = document.createElement('span');
    wtd.appendChild(span);

    var widget = new openils.widget.AutoFieldWidget({
        idlField : fieldIdl,
        fmObject : null, // XXX
        fmClass : fmcls,
        parentNode : span,
        widgetClass : wclass,
        dijitArgs : {style: wstyle},
        orgLimitPerms : ['UPDATE_USER'],
    });
    widget.build();
}


function ueLoadContextHelp(fmcls, fmfield) {
    openils.Util.removeCSSClass(dojo.byId('uedit-help-div'), 'hidden');
    dojo.byId('uedit-help-field').innerHTML = fieldmapper.IDL.fmclasses[fmcls].field_map[fmfield].label;
    dojo.byId('uedit-help-text').innerHTML = fieldDoc[fmcls][fmfield].string();
}


openils.Util.addOnLoad(load);

