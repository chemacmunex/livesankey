
// FUNCIONES DE INTERNALIZACIÓN
var set_locale_to = function(locale) {
    if (locale) {
        $.i18n().locale = locale;
    } else {
        var navigator = window.navigator.userLanguage || window.navigator.language;

        switch (navigator.slice(0,2)) {
            case 'en':
                $.i18n().locale = 'en';
                break;
            case 'es':
                $.i18n().locale = 'es-ES';
                break;
            case 'ru':
                $.i18n().locale = 'en';
                break;
            default:
                $.i18n().locale = 'en';
                break;
        }
    }

    $('.translate').each(function() {
        var args = [], $this = $(this);
        if ($this.data('args'))
            args = $this.data('args').split(',');
        $this.html( $.i18n.apply(null, args) );
    });
};

function i18nCustom(opt, arg) {
    $(opt).html( $.i18n(arg) );
};

$( document ).ready(function () {
    var checks_div = $('#checks_div');

    // LOAD data_model.json
    MONOVALUED = 'monovalued'
    MULTIVALUED = 'multivalued'

    TABLENAME = 'tablename'
    VALUES_COLNAME = 'values_colname'

    COLNAME = 'colname'
    DISPLAY_NAME = 'display_name'

    $.getJSON("/data_model", function(data) {
        var data_model_dic = {}
        data[MONOVALUED].map(function(table_dic){
            tablename = table_dic[TABLENAME]
            data_model_dic[tablename] = {}
            data_model_dic[tablename][VALUES_COLNAME] = table_dic[VALUES_COLNAME]
        })

        data[MULTIVALUED].map(function(table_dic){
            tablename = table_dic[TABLENAME]
            data_model_dic[tablename] = {}
            var obj = {}
            obj[COLNAME] = table_dic[VALUES_COLNAME]
            obj[DISPLAY_NAME] = table_dic[DISPLAY_NAME]
            data_model_dic[tablename][VALUES_COLNAME] = [obj]
        })
        console.log(data_model_dic)





        // Load checkboxes using columns in data_model
        for(var tablename in data_model_dic) {
            data_model_dic[tablename][VALUES_COLNAME].map(
                function(values_colname_dic){
                    var node_id = tablename + '.' + values_colname_dic[COLNAME]
                    var display_name = values_colname_dic[DISPLAY_NAME]
                    var div = $('<div/>').addClass("checkbox checkbox-success checkbox-inline");
                    var cb = $('<input/>').attr({
                        type: 'checkbox',
                        id: node_id + '_checkbox',
                        name: node_id,
                        "data-args": node_id,
                        value: display_name,
                        onclick: 'handleCheckClick(this);'});
                    var label = $('<label/>').attr({for: node_id + '_checkbox'}).addClass("translate").attr({"data-args": display_name});

                    div.append(cb)
                    div.append(label)
                    checks_div.append(div)
                }
            )
        }

        // Load internacionalization
        $.getJSON("./static/js/i18n/appInterface_es-ES.json", function(es_json_file) {
            $.getJSON("./static/js/i18n/appInterface_en.json", function(en_json_file) {
                $.getJSON("./static/js/i18n/userInterface_es-ES.json", function(user_es_json_file) {
                    $.getJSON("./static/js/i18n/userInterface_en.json", function(user_en_json_file) {

                        // Merge two dicts modifying the first
                        $.extend(es_json_file, user_es_json_file)
                        $.extend(en_json_file, user_en_json_file)

                        $.i18n().load({
                            'es-ES': es_json_file,
                            'en': en_json_file
                            //'ru': './static/js/i18n/ru.json'
                        }).done(function() {
                            set_locale_to();

                            $('#loading_img').attr("src", "/static/images/" + ($.i18n('loading_img')));

                            var navigator_aux = window.navigator.userLanguage || window.navigator.language;
                            console.log('navigator: ' + navigator_aux); //works IE/SAFARI/CHROME/FF
                            console.log('locale: ' + $.i18n().locale);
                        });
                    }).fail(function(){
                        console.log("Failed loading JSON file /js/i18n/userInterface_en.json")});
                }).fail(function(){
                    console.log("Failed loading JSON file /js/i18n/userInterface_es-ES.json")});
            }).fail(function(){
                console.log("Failed loading JSON file /js/i18n/appInterface_en.json")});
        }).fail(function(){
            console.log("Failed loading JSON file /js/i18n/appInterface_es-ES.json")});
    }).fail(function(){
        alert("Failed loading JSON file /data_model.json")});
});

function load_sankey(){
     // get selected and sorted nodes
     var selected = [];
     $('#order_select option').each(function() {
         selected.push($(this).attr('data-args'));
     });
    if (selected.length >= 2){
        // collapse filters
        $('#collapsable_div').attr({class: 'collapse'});

        // Display loading img
        $('#loading_div').css('display','block')

        // trigger click on collapse button:
        changeIcon()

        // query data
        window.cols_str_arr = JSON.stringify(selected);
        jQuery.ajax({
            url: '/sankey',
            method: 'POST',
            data: {
                cols_str_arr: window.cols_str_arr,
                nodesClicked_str_arr: '[]',
                dni_limit_str: rangeInput.value.toString()
            },
            success: function (result) {
                if (result.isOk == false) alert(result.message);

                result_json = JSON.parse(result)
                window.d3OldNodes = result_json.nodes;
                window.d3NewNodes = result_json.nodes;
                window.d3OldLinks = result_json.links;
                window.d3NewLinks = result_json.links;
                window.HTMLWidgets.staticRender();

                // adjust size of diagram
                $('#htmlwidget_container').css('position', 'relative');
                $('#htmlwidget-24179ebc2c9285457857').css('height', 'calc(100vh - 170px)');

                // Actualiza la informacion de los filtros
                var text = '';
                document.getElementById('filters_nodesClicked').innerHTML= text;

                // Show info_Filters
                $('#filters_info_container').css('display','inline-block')

                // Show htmlwidget
                $('#htmlwidget-24179ebc2c9285457857').addClass('border rounded')

                // Hide loading img
                $('#loading_div').css('display','none')

                // Traduce el contenido del diagrama
                set_locale_to();

            },
            error: function(result){
                console.log(result);
                console.log(window.cols_str_arr);
            }
        });
    }
}

function handleCheckClick(checkBox){
    var select = document.getElementById("order_select");
	if (checkBox.checked){
		var option = document.createElement("option");
        // option.classList.add("translate");
        option.setAttribute("data-args", checkBox.getAttribute('data-args'));
		option.value = checkBox.value;
        select.appendChild(option);
        if (select.childElementCount == 2) {
            document.getElementById("Load").classList.remove("disabled");
            document.getElementById("Load").title=" ";
        }
        i18nCustom(option, checkBox.value);
//        set_locale_to();
	} else {
        $('#order_select').find('option[value="' + checkBox.value + '"]').remove();
        if (select.childElementCount == 1) {
            document.getElementById("Load").classList.add("disabled");
            document.getElementById("Load").title="Selecciona al menos dos tipos de datos";
        }
	}
}

function resetSelect(){
    $('#order_select').empty();
    document.getElementById("Load").classList.add("disabled");
    document.getElementById("Load").title="Selecciona al menos dos tipos de datos";
}

function moveUp(){
    var ddl = document.getElementById('order_select');
    //var size = ddl.length;
    //var index = ddl.selectedIndex;
    var selectedItems = new Array();
	var temp = {innerHTML:null, value:null, data_args:null};
    for(var i = 0; i < ddl.length; i++)
        if(ddl.options[i].selected)
            selectedItems.push(i);

    if(selectedItems.length > 0)
        if(selectedItems[0] != 0)
            for(var i = 0; i < selectedItems.length; i++)
            {
				temp.innerHTML = ddl.options[selectedItems[i]].innerHTML;
				temp.value = ddl.options[selectedItems[i]].value;
				temp.data_args = ddl.options[selectedItems[i]].getAttribute('data-args');

                ddl.options[selectedItems[i]].innerHTML = ddl.options[selectedItems[i] - 1].innerHTML;
                ddl.options[selectedItems[i]].value = ddl.options[selectedItems[i] - 1].value;
                ddl.options[selectedItems[i]].setAttribute("data-args", ddl.options[selectedItems[i] - 1].getAttribute('data-args'));
                ddl.options[selectedItems[i]].selected = false;

                ddl.options[selectedItems[i] - 1].innerHTML = temp.innerHTML;
                ddl.options[selectedItems[i] - 1].value = temp.value;
                ddl.options[selectedItems[i] - 1].setAttribute("data-args", temp.data_args);
                ddl.options[selectedItems[i] - 1].selected = true;
            }
}

function moveDown(){
    var ddl = document.getElementById('order_select');
    //var size = ddl.length;
    //var index = ddl.selectedIndex;
    var selectedItems = new Array();
	var temp = {innerHTML:null, value:null, data_args:null};
    for(var i = 0; i < ddl.length; i++)
        if(ddl.options[i].selected)
            selectedItems.push(i);

    if(selectedItems.length > 0)
        if(selectedItems[selectedItems.length - 1] != ddl.length - 1)
            for(var i = selectedItems.length - 1; i >= 0; i--)
            {
                temp.innerHTML = ddl.options[selectedItems[i]].innerHTML;
                temp.value = ddl.options[selectedItems[i]].value;
				temp.data_args = ddl.options[selectedItems[i]].getAttribute('data-args');

                ddl.options[selectedItems[i]].innerHTML = ddl.options[selectedItems[i] + 1].innerHTML;
                ddl.options[selectedItems[i]].value = ddl.options[selectedItems[i] + 1].value;
                ddl.options[selectedItems[i]].setAttribute("data-args", ddl.options[selectedItems[i] + 1].getAttribute('data-args'));
                ddl.options[selectedItems[i]].selected = false;

                ddl.options[selectedItems[i] + 1].innerHTML = temp.innerHTML;
                ddl.options[selectedItems[i] + 1].value = temp.value;
                ddl.options[selectedItems[i] + 1].setAttribute("data-args", temp.data_args);
                ddl.options[selectedItems[i] + 1].selected = true;
            }
}

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function changeIcon(){
    if ($('#arrow_icon').hasClass('fa-angle-double-up'))
        $('#arrow_icon').addClass('fa-angle-double-down').removeClass('fa-angle-double-up');
    else
        $('#arrow_icon').addClass('fa-angle-double-up').removeClass('fa-angle-double-down');
}