HTMLWidgets.widget({
    name: "sankeyNetwork",

    type: "output",

    initialize: function (el, width, height) {

        d3.select(el).append("svg")
            .style("width", "100%")
            .style("height", "100%");

        return {
            sankey: d3.sankey(),
            x: null
        };
    },

    resize: function (el, width, height, instance) {
        /*  handle resizing now through the viewBox
        d3.select(el).select("svg")
            .attr("width", width)
            .attr("height", height + height * 0.05);

        this.renderValue(el, instance.x, instance);
        */
        
        // with flexdashboard and slides
        //   sankey might be hidden so height and width 0
        //   in this instance re-render on resize
        if (d3.min(instance.sankey.size()) <= 0) {
            this.renderValue(el, instance.x, instance);
        }
    },

    renderValue: function (el, x, instance) {

        // save the x in our instance (for calling back from resize)
        instance.x = x;

        // alias sankey and options
        var sankey = instance.sankey;
        var options = x.options;

        nodesClicked = [];
        linkCount = 0;
        nodeCount = 0;
        allDataNodes = [];

        var dni_limit_aux = rangeInput.value.toString();

        // set the 'onClick' funcionality to reset filters button
        $('#filters_clean').off("click");
        $('#filters_clean').click(function(e){
            resetFilters();                   
        });

		// used to save x,y coords when click and update oldNodes created
        oldDataNodes_dic_backup = {};
        newDataNodes_dic_backup = {};

        oldDataNodes_dic_obj = {};
        newDataNodes_dic_obj = {};
        
        /*  Key = "source.name" + "->" + "target.name"
            Value = link */
        oldLinksDict = {};

        //from sankey_filter.js function load_sankey()
        var d3OldNodes = window.d3OldNodes;
        var d3NewNodes = window.d3NewNodes;
        var d3OldLinks = window.d3OldLinks;
        var d3NewLinks = window.d3NewLinks;

        // margin handling
        //   set our default margin to be 20
        //   will override with x.options.margin if provided
        var margin = {top: 20, right: 0, bottom: 20, left: 0};
        //   go through each key of x.options.margin
        //   use this value if provided from the R side
        Object.keys(x.options.margin).map(function (ky) {
            if (x.options.margin[ky] !== null) {
                margin[ky] = x.options.margin[ky];
            }
            // set the margin on the svg with css style
            // commenting this out since not correct
            // s.style(["margin",ky].join("-"), margin[ky]);
        });

        // get the width and height
        var width = el.getBoundingClientRect().width - margin.right - margin.left;
        var height = el.getBoundingClientRect().height - margin.top - margin.bottom;

        var color = eval(options.colourScale);

        var color_node = function color_node(d) {
            if (d.group) {
                return color(d.group.replace(/ .*/, ""));
            } else {
                return "#cccccc";
            }
        };

        var color_link = function color_link(d) {
            if (d.group) {
                return color(d.group.replace(/ .*/, ""));
            } else {
                return "#000000";
            }
        };

        var opacity_link = function opacity_link(d) {
            if (d.group) {
                return 0.7;
            } else {
                return 0.2;
            }
        };

        var formatNumber = d3.format(",.0f"),
            format = function (d) { return formatNumber(d); };
        // Type: old/new
        var formatFilterText = function(array, type){
            if (array.length != 0){
                var traduced = [' ('];
                var data = array.map(function(keyname) {
                    var nodeNameArray = keyname.split(".");
                    nodeNameArray.splice(0,2);  // removes table.col
                    nodeNameOnly = nodeNameArray.join("");
                    return $.i18n(nodeNameOnly); });

                Array.prototype.push.apply(traduced,[data.join(', ')]);
                traduced.push(')');
                return (type == 'new')? traduced.join('') : $.i18n('_sin_filtrar');
            } else {
                return '';
            }
        };
        var formatFilterTitle = function(){
            return $.i18n('doble_click_sobre_nodo_para_filtrar');
        }
        
        // Resetea el viewBox
        var resetedViewBox = true;
        var _1,_2,_3,_4;

        // Resetea los valores del Zoom
        var zoomState = d3.zoomIdentity;
        zoomState.k = 1;
        zoomState.x = 0;
        zoomState.y = 0;
//        var zoomReset = true;

        // Limites del Drag
        var XLef = -width * .5;
        var XRig = width * .5;
        var YTop = -height * .5;
        var YBot = height * .5;
        var limitXLef = XLef;
        var limitXRig = XRig;
        var limitYTop = YTop;
        var limitYBot = YBot;

        // Numero maximo de caracteres en el nombre de los nodos
        maxNodeName = 32;

        function loadWidgetContent() {

            // create d3 sankey layout
            sankey
                .nodes(d3NewNodes)
                .links(d3NewLinks)
                .size([width, height])
                .nodeWidth(options.nodeWidth)
                .nodePadding(options.nodePadding)
                .sinksRight(options.sinksRight)
                .layout(options.iterations);

            sankey
                .nodes(d3OldNodes)
                .links(d3OldLinks)
                .size([width, height])
                .nodeWidth(options.nodeWidth)
                .nodePadding(options.nodePadding)
                .sinksRight(options.sinksRight)
                .layout(options.iterations);

            // select the svg element and remove ALL existing children
            d3.select(el).select("svg").selectAll("*").remove();
            // append g for our container to transform by margin
            var svg = d3.select(el).select("svg")
                .style("transform-origin", "50% 50% 0")
                .call(zoomObject)
                .append("g")
                .style("margin-top", margin.top);

            // remove any previously set viewBox attribute
            d3.select(el).select("svg").attr("viewBox", null);

            // draw path
            path = sankey.link();

            drawOldLinksAndNodes();
			updateOldLinksPath();
            drawNewLinksAndNodes();

			// adjust viewBox to fit the bounds of our tree
            var s = d3.select(svg.node().parentNode);
//            console.log("_1:" + _1 + " || _2:" + _2 + " || _3:" + _3 + " || _4:" + _4);
            s.attr(
				"viewBox",
				[
					(_1!==undefined)?_1 : _1 = (d3.min(
						s.selectAll('g').nodes().map(function (d) {
							return d.getBoundingClientRect().left;
						})
					) - s.node().getBoundingClientRect().left - margin.right),
					(_2!==undefined)?_2 : _2 = (d3.min(
						s.selectAll('g').nodes().map(function (d) {
							return d.getBoundingClientRect().top;
						})
					) - s.node().getBoundingClientRect().top - margin.top),
					(_3!==undefined)?_3 : _3 = (d3.max(
						s.selectAll('g').nodes().map(function (d) {
							return d.getBoundingClientRect().right;
						})
					) -
					d3.min(
						s.selectAll('g').nodes().map(function (d) {
							return d.getBoundingClientRect().left;
						})
					)  + margin.left + margin.right),
					(_4!==undefined)?_4 : _4 = (d3.max(
						s.selectAll('g').nodes().map(function (d) {
							return d.getBoundingClientRect().bottom;
						})
					) -
					d3.min(
						s.selectAll('g').nodes().map(function (d) {
							return d.getBoundingClientRect().top;
						})
					) + margin.top + margin.bottom)
				].join(",")
			);
            

            // Inicializa el zoomObject con los valores almacenados en el zoomstate
            d3.select(el).select("svg").call(zoomObject.transform, zoomState);
//            d3.select(el).select("svg").transition().duration(750).call(zoomObject.transform, d3.zoomIdentity);

			function drawOldLinksAndNodes(){
				// -------------------------------------------------------------------------------------------------
				// -------------------------------------------------------------------------------------------------
				//                                               OLD:
				// -------------------------------------------------------------------------------------------------
				// -------------------------------------------------------------------------------------------------
                // draw links
                oldLinks = svg.append("g").selectAll(".link")
                    .data(d3OldLinks)
                    .enter().append("path")
                    .attr("type","old")
                    .attr("class", "link")
                    .attr("d", path)
                    .attr("id", function(d,i){
                        d.id = linkCount++;
                        return "link-" + d.id;
                    })
                    .attr("name", function(d){ return $.i18n(d.source.name) + "->" + $.i18n(d.target.name); })
                    .attr("value", function(d){ return d.value; })
                    .attr("strokeWidth", function(d) { return Math.max(1, d.dy); })
                    .style("stroke-width", function(d) { return Math.max(1, d.dy); })
                    .style("fill", "none")
                    .style("stroke", color_link)
                    .style("stroke-opacity", function(d){
                        if (nodesClicked.length == 0)
                            return 0.9;
                        else
                            return 0.2;
                    })
                    .sort(function(a, b) { return b.dy - a.dy; })

                // add backwards class to cycles
                oldLinks.classed('backwards', function (d) { return d.target.x < d.source.x; });

                svg.selectAll(".link.backwards")
                    .style("stroke-dasharray","9,1")
                    .style("stroke","#402")

                // draw nodes
                oldNodes = svg.append("g").selectAll(".node")
                    .data(d3OldNodes)
                    .enter().append("g")
                    .attr("type","old")
                    .attr("class",  function(d) { return "node"; })
                    .attr("transform", function(d) {
                        if (d.name in oldDataNodes_dic_backup){
                            d.id = oldDataNodes_dic_backup[d.name]['id']; 
                            d.x = oldDataNodes_dic_backup[d.name]['x'];
                            d.y = oldDataNodes_dic_backup[d.name]['y'];
                            d.dy = oldDataNodes_dic_backup[d.name]['dy'];
                        } else {
                            d.id = nodeCount++; 
                            oldDataNodes_dic_backup[d.name] = {};
                            oldDataNodes_dic_backup[d.name]['id'] = d.id;
                            oldDataNodes_dic_backup[d.name]['x'] = d.x;
                            oldDataNodes_dic_backup[d.name]['y'] = d.y;
                            oldDataNodes_dic_backup[d.name]['dy'] = d.dy;
                        }
                        oldDataNodes_dic_obj[d.name] = d;

                        return "translate(" + d.x + "," + d.y + ")";
                    })
                    .attr("name", function(d) { return d.name;})
                    .on("dblclick", nodeClick)
                    .call(
                        d3.drag().subject(function(d) {
                            return d;
                        })
                        .on("drag", dragmove)
                    )

                //note: u2192 is right-arrow
                oldLinks.append("title")
                    .append("foreignObject")
                    .append("xhtml:body")
                    .html(function(d) {
                        return "<pre>" + $.i18n(d.source.name) + " \u2192 " + $.i18n(d.target.name) + "\n" + $.i18n('instancias') + ": " + format(d.value) + " " + options.units + " " + formatFilterText(nodesClicked, 'old') + "</pre>"; });

                oldNodes.append("rect")
                    .attr("height", function(d) {
                        return d.dy; 
                    })
                    .attr("width", sankey.nodeWidth())
                    .style("fill", function(d) { return d.color = color_node(d); })
                    .style("stroke", function(d) { return d3.rgb(d.color).darker(2); })
                    .style("opacity", function(d){
                        if (nodesClicked.length == 0)
                            return 0.9;
                        else
                            return 0.1;
                    })
                    .style("cursor", "move")
                    .append("title")
                    .append("foreignObject")
                    .append("xhtml:body")
                    .html(function(d) { return "<pre>" + $.i18n(d.name) + "\n" + $.i18n('instancias') + ": " + format(d.value) + " " + options.units + "</pre>"; });

                oldNodesLongName = oldNodes.filter(function(d) {
                    if ($.i18n(d.name).length > maxNodeName) {
                        return d;
                    }
                });
                oldNodesShortName = oldNodes.filter(function(d) {
                    if ($.i18n(d.name).length <= maxNodeName) {
                        return d;
                    }
                });
                oldNodesShortName.append("text")
                    .attr("x", -6)
                    .attr("y", function(d) { return d.dy / 2; })
                    .attr("dy", ".35em")
                    .attr("text-anchor", "end")
                    .attr("transform", null)
                    .text(function(d) {
                        return $.i18n(d.name)
                    })
                    .style("cursor", "move")
                    .style("font-size", width/100 + "px")
                    .style("font-family", options.fontFamily ? options.fontFamily : "inherit")
                    .style("font-weight", "bold")
                    .style("opacity", function(d){
                        if (nodesClicked.length == 0)
                            return 1;
                        else
                            return 0.4;
                    })
                    .filter(function(d) { return d.x < width / 2 || !options.sinksRight; })
                    .attr("x", 6 + sankey.nodeWidth())
                    .attr("text-anchor", "start");

                // Primera parte del nombre largo
                oldNodesLongName.append("text")
                    .attr("x", -6)
                    .attr("y", function(d) {
                        return (d.dy / 2) - (height/130 + 2);
                    })
                    .attr("dy", ".35em")
                    .attr("text-anchor", "end")
                    .attr("transform", null)
                    .text(function(d) {
                        var auxName = $.i18n(d.name).slice(0, maxNodeName + 1);
                        var splits = auxName.split(' ');
                        var extra_OldSplit = splits[splits.length - 1].length;
                        return $.i18n(d.name).slice(0, maxNodeName - extra_OldSplit);
                    })
                    .style("cursor", "move")
                    .style("font-size", width/100 + "px")
                    .style("font-family", options.fontFamily ? options.fontFamily : "inherit")
                    .style("font-weight", "bold")
                    .style("opacity", function(d){
                        if (nodesClicked.length == 0)
                            return 1;
                        else
                            return 0.4;
                    })
                    .filter(function(d) { return d.x < width / 2 || !options.sinksRight; })
                    .attr("x", 6 + sankey.nodeWidth())
                    .attr("text-anchor", "start");
                
                // Segunda parte del nombre largo
                oldNodesLongName.append("text")
                    .attr("x", -6)
                    .attr("y", function(d) {
                        return (d.dy / 2) + (height/130 + 2);
                    })
                    .attr("dy", ".35em")
                    .attr("text-anchor", "end")
                    .attr("transform", null)
                    .text(function(d) {
                        var auxName = $.i18n(d.name).slice(0, maxNodeName + 1);
                        var splits = auxName.split(' ');
                        var extra_OldSplit = splits[splits.length - 1].length;
                        if ($.i18n(d.name).length <= (maxNodeName * 2)) {
                            return $.i18n(d.name).slice((maxNodeName - extra_OldSplit),$.i18n(d.name).length);
                        } else {
                            return $.i18n(d.name).slice((maxNodeName - extra_OldSplit),maxNodeName * 2) + '...';
                        }
                    })
                    .style("cursor", "move")
                    .style("font-size", width/100 + "px")
                    .style("font-family", options.fontFamily ? options.fontFamily : "inherit")
                    .style("font-weight", "bold")
                    .style("opacity", function(d){
                        if (nodesClicked.length == 0)
                            return 1;
                        else
                            return 0.4;
                    })
                    .filter(function(d) { return d.x < width / 2 || !options.sinksRight; })
                    .attr("x", 6 + sankey.nodeWidth())
                    .attr("text-anchor", "start");
			}


			function drawNewLinksAndNodes(){
				// #################################################################################################
				// #################################################################################################
				//                                               NEW:
				// #################################################################################################
				// #################################################################################################
                // draw links
                newLinks = svg.append("g").selectAll(".link")
                    .data(d3NewLinks)
                    .enter().append("path")
                    .attr("type","new")
                    .attr("class", "link")
                    .attr("d", path)
                    .attr("id", function(d,i) {
                        d.id = linkCount++;
                        return "link-" + d.id;
                    })
                    .attr("name", function(d){ return $.i18n(d.source.name) + "->" + $.i18n(d.target.name); })
                    .attr("value", function(d){ return d.value; ; })
                    .attr("strokeWidth", function(d) { return Math.max(1, d.dy); })
                    .style("stroke-width", function(d) { return Math.max(1, d.dy); })
                    .style("fill", "none")
                    .style("stroke", color_link)
                    .style("stroke-opacity", 0.9)
                    .sort(function(a, b) { return b.dy - a.dy; })

                // add backwards class to cycles
                newLinks.classed('backwards', function (d) { return d.target.x < d.source.x; });

                svg.selectAll(".link.backwards")
                    .style("stroke-dasharray","9,1")
                    .style("stroke","#402")
 
                // draw nodes
                newNodes = svg.append("g").selectAll(".node")
                    .data(d3NewNodes)
                    .enter().append("g")
                    .attr("type", "new")
                    .attr("class", function(d) { return "node"; })
                    .attr("transform", function(d) {
                        if(d.name != ""){
                            d.x = oldDataNodes_dic_backup[d.name].x;
                            d.y = oldDataNodes_dic_backup[d.name].y;
                            d.dy = oldDataNodes_dic_backup[d.name].dy;
                        }

                        newDataNodes_dic_backup[d.name] = {};
                        d.id = nodeCount++; 
                        newDataNodes_dic_backup[d.name]['id'] = d.id;
                        newDataNodes_dic_backup[d.name]['x'] = d.x;
                        newDataNodes_dic_backup[d.name]['y'] = d.y;
                        newDataNodes_dic_backup[d.name]['dy'] = d.dy;

                        newDataNodes_dic_obj[d.name] = d;

                        return "translate(" + d.x + "," + d.y + ")"; 
                    })
                    .attr("name", function(d) { return d.name; })
                    .on("dblclick", nodeClick)
                    .call(d3.drag()
                          .subject(function(d) { return d; })
                          .on("drag", dragmove))

                // note: u2192 is right-arrow
                newLinks.append("title")
                    .append("foreignObject")
                    .append("xhtml:body")
                    .html(function(d) { return "<pre>" + $.i18n(d.source.name) + " \u2192 " + $.i18n(d.target.name) + "\n" + $.i18n('instancias') + ": " + format(d.value) + " " + options.units + formatFilterText(nodesClicked, 'new') + "</pre>"; });

                newNodes.append("rect")
                    .attr("height", function(d) { return d.dy; })
                    .attr("width", sankey.nodeWidth())
                    .style("fill", function(d) { return d.color = color_node(d); })
                    .style("stroke", function(d) { return d3.rgb(d.color).darker(2); })
                    .style("opacity", 0.9)
                    .style("cursor", "move")
                    .append("title")
                    .append("foreignObject")
                    .append("xhtml:body")
                    .html(function(d) { 
                    	// always shows the total in node even if it is filtered
                    	var value = oldDataNodes_dic_obj[d.name].value;
                    	return "<pre>" + $.i18n(d.name) + "\n" + $.i18n('instancias') + ": " + format(value) + " " + options.units + "\n\n" + formatFilterTitle() + "</pre>"; });

                newNodesLongName = newNodes.filter(function(d) {
                    if ($.i18n(d.name).length > maxNodeName) {
                        return d;
                    }
                });
                newNodesShortName = newNodes.filter(function(d) {
                    if ($.i18n(d.name).length <= maxNodeName) {
                        return d;
                    }
                });
                
                // Gestion de nombres cortos del nodo
                newNodesShortName.append("text")
                    .attr("x", -6)
                    .attr("y", function(d) {
                            return d.dy / 2;
                    })
                    .attr("dy", ".35em")
                    .attr("text-anchor", "end")
                    .attr("transform", null)
                    .text(function(d) {
                        return $.i18n(d.name)
                    })
                    .style("cursor", "move")
                    .style("font-size", width/100 + "px")
                    .style("font-family", options.fontFamily ? options.fontFamily : "inherit")
                    .style("font-weight", "bold")
                    .filter(function(d) { return d.x < width / 2 || !options.sinksRight; })
                    .attr("x", 6 + sankey.nodeWidth())
                    .attr("text-anchor", "start")
                    .append("title")
                    .append("foreignObject")
                    .append("xhtml:body")
                    .html(function(d) { return "<pre>" + $.i18n(d.name) + "\n" + $.i18n('instancias') + ": " + format(d.value) + " " + options.units + "\n\n"+ formatFilterTitle() + "</pre>"; });
                
                // Primera parte del nombre largo
                newNodesLongName.append("text")
                    .attr("x", -6)
                    .attr("y", function(d) {
                        return (d.dy / 2) - (height/130 + 2);
                    })
                    .attr("dy", ".35em")
                    .attr("text-anchor", "end")
                    .attr("transform", null)
                    .text(function(d) {
                        var auxName = $.i18n(d.name).slice(0, maxNodeName + 1);
                        var splits = auxName.split(' ');
                        var extra_NewSplit = splits[splits.length - 1].length;
                        return $.i18n(d.name).slice(0, maxNodeName - extra_NewSplit);
                    })
                    .style("cursor", "move")
                    .style("font-size", width/100 + "px")
                    .style("font-family", options.fontFamily ? options.fontFamily : "inherit")
                    .style("font-weight", "bold")
                    .filter(function(d) { return d.x < width / 2 || !options.sinksRight; })
                    .attr("x", 6 + sankey.nodeWidth())
                    .attr("text-anchor", "start")
                    .append("title")
                    .append("foreignObject")
                    .append("xhtml:body")
                    .html(function(d) { return "<pre>" + $.i18n(d.name) + "\n" + $.i18n('instancias') + ": " + format(d.value) + " " + options.units + "\n\n" + formatFilterTitle() + "</pre>"; });
                
                // Segunda parte del nombre largo
                newNodesLongName.append("text")
                    .attr("x", -6)
                    .attr("y", function(d) {
                        return (d.dy / 2) + (height/130 + 2);
                    })
                    .attr("dy", ".35em")
                    .attr("text-anchor", "end")
                    .attr("transform", null)
                    .text(function(d) {
                        var auxName = $.i18n(d.name).slice(0, maxNodeName + 1);
                        var splits = auxName.split(' ');
                        var extra_NewSplit = splits[splits.length - 1].length;
                        if ($.i18n(d.name).length <= (maxNodeName * 2)) {
                            return $.i18n(d.name).slice(maxNodeName - extra_NewSplit,$.i18n(d.name).length);
                        } else {
                            return $.i18n(d.name).slice(maxNodeName - extra_NewSplit,maxNodeName * 2) + '...';
                        }
                    })
                    .style("cursor", "move")
                    .style("font-size", width/100 + "px")
                    .style("font-family", options.fontFamily ? options.fontFamily : "inherit")
                    .style("font-weight", "bold")
                    .filter(function(d) { return d.x < width / 2 || !options.sinksRight; })
                    .attr("x", 6 + sankey.nodeWidth())
                    .attr("text-anchor", "start")
                    .append("title")
                    .append("foreignObject")
                    .append("xhtml:body")
                    .html(function(d) { return "<pre>" + $.i18n(d.name) + "\n" + $.i18n('instancias') + ": " + format(d.value) + " " + options.units + "\n\n" + formatFilterTitle() + "</pre>"; });

				// # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # #
				//                                              END NEW:
				// # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # #
            }
        }

		function nodeClick(d){
            if (d3.event != null)
                if (d3.event.defaultPrevented) return;
            if (nodesClicked.includes(d.key)){
                // splice is to remove an element: splice(start elementIndex,number of elements to remove from index)
                nodesClicked.splice(nodesClicked.indexOf(d.key), 1);
            } else {
                nodesClicked.push(d.key);
            }

            // Display loading img
            console.log(jQuery('#loading_div'));
            jQuery('#loading_div').attr('style',  'display:block');

            jQuery.ajax({
                url: '/sankey',
                method: 'POST',
                data: {
                    cols_str_arr: window.cols_str_arr, //from sankey_filter.js function load_sankey()
                    nodesClicked_str_arr: JSON.stringify(nodesClicked),
                    dni_limit_str: dni_limit_aux
                },
                success: function (result) {
                    if (result.isOk == false)
                        alert(result.message);

                    var result_json = JSON.parse(result);
                    d3NewNodes = result_json.nodes;
                    d3NewLinks = result_json.links;

                    // Hide loading img
                    jQuery('#loading_div').css('display','none');
                    loadWidgetContent();
                    updateNewLinks();
                    
                    // Actualiza la informacion de los filtros
                    var text = '';
                    for (var n = 0 ; n < nodesClicked.length; n++){
                        var aux1 = $.i18n("elimina_el_filtro");
                        var nodeClicked = nodesClicked[n]

                        var nodeNameArray = nodeClicked.split(".")
                        nodeNameArray.splice(0,2)  // removes table.col
                        var nodeName = $.i18n(nodeNameArray.join(""));

                        text = text.concat('<a href="#" title="', aux1,'" class="border rounded" id="id_', n, '" data-args="', nodesClicked[n],'" onclick="return false;">', nodeName, '</a>');
                    }
                    document.getElementById('filters_nodesClicked').innerHTML= text;
                    // Añade el Listener del click a los filtros
                    for (var n = 0 ; n < nodesClicked.length; n++){
                        jQuery('#id_'.concat(n)).click(function(e){
                            var aux=[];
                            aux.key = e.target.getAttribute('data-args');
                            nodeClick(aux);

                            return false;
                        });
                    }
                    
                },
                error: function(result){
                    console.log(result);
                }
            });
		}

		function resetFilters(){
            if (nodesClicked.length != 0){
                // remove all elements
                nodesClicked = [];

                // Display loading img
                console.log(jQuery('#loading_div'))
                jQuery('#loading_div').attr('style', 'display:block');

                jQuery.ajax({
                    url: '/sankey',
                    method: 'POST',
                    data: {
                        cols_str_arr: window.cols_str_arr, //from sankey_filter.js function load_sankey()
                        nodesClicked_str_arr: JSON.stringify(nodesClicked),
                        dni_limit_str: dni_limit_aux
                    },
                    success: function (result) {
                        if (result.isOk == false)
                            alert(result.message);

                        var result_json = JSON.parse(result);
                        d3NewNodes = result_json.nodes;
                        d3NewLinks = result_json.links;

                        // Hide loading img
                        jQuery('#loading_div').css('display','none');
                        loadWidgetContent();
                        updateNewLinks();

                        // Actualiza la informacion de los filtros
                        var text = '';
                        document.getElementById('filters_nodesClicked').innerHTML= text;
                    },
                    error: function(result){
                        console.log(result);
                    }
                });
            }
		}

        function updateOldLinksDict(){
            for (var i = 0 ; i < oldLinks._groups[0].length; i++)
                oldLinksDict[oldLinks._groups[0][i].attributes.name.value] = oldLinks._groups[0][i];
        }

        function updateNewLinksPath(){
            for (var i = 0 ; i < newLinks._groups[0].length; i++){
                var name = newLinks._groups[0][i].attributes.name.value;
                if(name in oldLinksDict)
                    newLinks._groups[0][i].attributes.d.value = oldLinksDict[name].attributes.d.value;
            }
        }

        function updateOldLinksPath(){
            for (var i = 0 ; i < oldLinks._groups[0].length; i++){
                var name = oldLinks._groups[0][i].attributes.name.value;
                if(name in oldLinksDict)
                    oldLinks._groups[0][i].attributes.d.value = oldLinksDict[name].attributes.d.value;
            }
        }

        function calculateNewWidth(newValue, oldValue, oldStrokeWidth){
            return newValue * oldStrokeWidth / oldValue;
        }

        function updateNewLinksWidth(){
            for (var i = 0 ; i < newLinks._groups[0].length; i++){
                var newLink = newLinks._groups[0][i];
                var newLinkName = newLink.attributes.name.value;
                if (newLinkName in oldLinksDict){
                    var oldLink = oldLinksDict[newLinkName];
                    newLink.attributes.style.value = newLink.attributes.style.value + " stroke-width: " + 
                        calculateNewWidth(
                            parseInt(newLink.attributes.value.value),
                            parseInt(oldLink.attributes.value.value),
                            parseInt(oldLink.attributes.strokeWidth.value)
                        ) + ";";
                }
            }
        }

        function updateNewLinks(){
            updateOldLinksDict();
            updateNewLinksPath();
            updateNewLinksWidth();
        }

        function dragmove(d) {
            var nodes = document.getElementsByClassName("node");

            for (var i = 0; i < nodes.length; i++) {
                if (nodes[i].attributes.name.value == this.attributes.name.value){
                    d3.select(nodes[i]).attr("transform", "translate(" + d.x + "," + (d.y = Math.max(0, Math.min(height - d.dy, d3.event.y))) + ")");
                    oldDataNodes_dic_backup[d.name]['y'] = d.y;
                    newDataNodes_dic_backup[d.name]['y'] = d.y;

                    oldDataNodes_dic_obj[d.name].y = d.y;
                    newDataNodes_dic_obj[d.name].y = d.y;
                }
            }

            sankey.relayout();
            oldLinks.attr("d", path);
            updateNewLinks();
        }

        // Zoom funcionality
        var zoomObject = d3.zoom()
            .scaleExtent([1, 4])
            .on("zoom", zoomed)
            .filter(function(){
                // Exclude all events except wheel and click events
                return (d3.event.type === "wheel" || d3.event.type === "mousedown");
            });

        function zoomed() {
            if (d3.event.sourceEvent !== null) {
                // Zoom sobre la POSICION de cursor en el diagrama
                if (d3.event.sourceEvent.type !== "mousemove") {
                    // Zoom IN
                    if (d3.event.sourceEvent.wheelDelta > 0 || d3.event.sourceEvent.deltaY < 0){
                        // El evento Zoom actualiza el ESTADO
                        zoomState = d3.event.transform;
                    }
                    // Zoom OUT
                    else {
                        // Si no es el Zoom Inicial (scale == 1)
                        if (zoomState.k !== 1) {
                            // Calcula la nueva posicion (x,y)
                            zoomState.x = zoomState.x * ((d3.event.transform.k - 1)/(zoomState.k - 1));
                            zoomState.y = zoomState.y * ((d3.event.transform.k - 1)/(zoomState.k - 1));
                            // El evento Zoom actualiza el ESTADO
                            zoomState.k = d3.event.transform.k;
                            // Sobreescribe el evento con los valores calculados
                            d3.event.transform.x = zoomState.x;
                            d3.event.transform.y = zoomState.y;
                        }
                    }
                }
                // DRAG
                else {
                    // Evita que se salga de los límites
                    if ((limitXLef <= d3.event.transform.x) && (d3.event.transform.x <= limitXRig)) {
                        if ((limitYTop <= d3.event.transform.y) && (d3.event.transform.y <= limitYBot)) {

                            // El evento Drag actualiza el ESTADO
                            zoomState.x = d3.event.transform.x;
                            zoomState.y = d3.event.transform.y;
                        }else {                        
                            // El evento Drag.x actualiza el ESTADO.x
                            zoomState.x = d3.event.transform.x;
                            // El evento Drag se sale del limiteY
                            d3.event.transform.y = zoomState.y;
                        }
                    } else {
                        if ((limitYTop <= d3.event.transform.y) && (d3.event.transform.y <= limitYBot)) {

                            // El evento Drag.y actualiza el ESTADO.y
                            zoomState.y = d3.event.transform.y;
                            // El evento Drag se sale del limiteX
                            d3.event.transform.x = zoomState.x;
                        }else {
                            // El evento Drag se sale de ambos límites
                            d3.event.transform.x = zoomState.x;
                            d3.event.transform.y = zoomState.y;
                        }
                    }
                }
                // Modifica el límite en función de la escala aplicada 
                limitXLef = XLef - (width * 0.33 * ((zoomState.k - 1)*2));
                limitXRig = XRig;
                limitYTop = YTop - (height * 0.5 * ((zoomState.k - 1)*2));
                limitYBot = YBot;

                // Controla que el zoom no se salga de los limites
                if (zoomState.x <= limitXLef) {
                    zoomState.x = limitXLef + 10;
                }
                if (limitXRig <= zoomState.x) {
                    zoomState.x = limitXRig - 10;
                }
                if (zoomState.y <= limitYTop) {
                    zoomState.y = limitYTop + 10;
                }
                if (limitYBot <= zoomState.y) {
                    zoomState.y = limitYBot - 10;
                }
            }

            // Modifica la vista con los valores del ESTADO
            d3.select(el).select("svg").select('g').attr("transform", zoomState);
        }

        loadWidgetContent();
        updateNewLinks();
    },
});
