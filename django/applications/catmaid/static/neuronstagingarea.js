/* -*- mode: espresso; espresso-indent-level: 2; indent-tabs-mode: nil -*- */
/* vim: set softtabstop=2 shiftwidth=2 tabstop=2 expandtab: */

"use strict";

var SelectionTable = function() {
  this.widgetID = this.registerInstance();
  this.registerSource();

  this.skeletons = [];
  this.skeleton_ids = {}; // skeleton_id vs index in skeleton array
  this.reviews = {};  // skeleton_id vs review percentage
  this.all_visible = true;
  this.all_synapses_visible = {pre: true, post: true};
  this.selected_skeleton_id = null;
  this.next_color_index = 0;
  this.gui = new this.GUI(this, 20);
};

SelectionTable.prototype = {};
$.extend(SelectionTable.prototype, new InstanceRegistry());
$.extend(SelectionTable.prototype, new SkeletonSource());
$.extend(SelectionTable.prototype, new Colorizer());

SelectionTable.prototype.highlighting_color = "#d6ffb5";

SelectionTable.prototype.getName = function() {
  return "Selection " + this.widgetID;
};

SelectionTable.prototype.destroy = function() {
  delete this.linkTarget;
  this.clear(); // clear after clearing linkTarget, so it doesn't get cleared
  this.unregisterInstance();
  this.unregisterSource();
};

SelectionTable.prototype.updateModels = function(models, source_chain) {
  if (source_chain && (this in source_chain)) return; // break propagation loop
  if (!source_chain) source_chain = {};
  source_chain[this] = this;

  var new_models = {};
  Object.keys(models).forEach(function(skid) {
    var model = models[skid];
    if (skid in this.skeleton_ids) {
      this.skeletons[this.skeleton_ids[model.id]] = model.clone();
    } else {
      new_models[skid] = model;
    }
  }, this);

  if (Object.keys(new_models).length > 0) this.append(new_models);
  else this.gui.update();

  this.updateLink(models, source_chain);
};

SelectionTable.prototype.SkeletonModel = function( id, neuronname, color ) {
    this.id = parseInt(id);
    this.baseName = neuronname;
    this.selected = true;
    this.pre_visible = true;
    this.post_visible = true;
    this.text_visible = false;
    this.color = color;
    this.opacity = 1; // from 0 to 1
};

SelectionTable.prototype.SkeletonModel.prototype = {};

SelectionTable.prototype.SkeletonModel.prototype.setVisible = function(v) {
    this.selected = v;
    this.pre_visible = v;
    this.post_visible = v;
    if (!v) this.text_visible = v;
};

SelectionTable.prototype.SkeletonModel.prototype.clone = function() {
  var m = new SelectionTable.prototype.SkeletonModel(this.id, this.baseName, this.color.clone());
  m.selected = this.selected;
  m.pre_visible = this.pre_visible;
  m.post_visible = this.post_visible;
  m.text_visible = this.text_visible;
  m.opacity = this.opacity;
  return m;
};

// TODO doesn't do anything?
SelectionTable.prototype.SkeletonModel.prototype.property_dialog = function() {
  var dialog = document.createElement('div');
  dialog.setAttribute("id", "dialog-confirm");
  dialog.setAttribute("title", "Skeleton Properties");

  var entry = document.createElement('input');
  entry.setAttribute("type", "text");
  entry.setAttribute("id", "skeleton-selected");
  entry.setAttribute("value", self.selected );
  dialog.appendChild(entry);

  $(dialog).dialog({
    height: 440,
    modal: true,
    buttons: {
      "Cancel": function() {
        $(this).dialog("close");
      },
      "OK": function() {
        $(this).dialog("close");
      }
    }
  });
};

SelectionTable.prototype.SkeletonModel.prototype.skeleton_info = function() {
  // TODO if the skeleton is loaded in the WebGLApp, then all of this information
  // is already present in the client
  // Additionally, the node count should be continued by the user contribution
  // (that is, how many nodes each user contributed). Same for review status.
  // And the "Downstream skeletons" should be split into two: skeletons with more than one node, and skeletons with one single node (placeholder pre- or postsynaptic nodes).
  requestQueue.register(django_url + project.id + '/skeleton/' + this.id + '/statistics', "POST", {},
      function (status, text, xml) {
        if (status === 200) {
          if (text && text !== " ") {
            var e = $.parseJSON(text);
            if (e.error) {
                alert(e.error);
            } else {
              var dialog = document.createElement('div');
              dialog.setAttribute("id", "dialog-confirm");
              dialog.setAttribute("title", "Skeleton Information");
              var msg = document.createElement('p');
              msg.innerHTML = 
                  "Neuron Name: " + self.baseName + ' #' + self.id + "<br />" +
                  "Node count: " + e.node_count + "<br />" +
                  "Postsynaptic sites: " + e.postsynaptic_sites + "<br />" +
                  "Upstream skeletons: " + e.input_count + "<br />" +
                  "Presynaptic sites: " + e.presynaptic_sites + "<br />" +
                  "Downstream skeletons: " + e.output_count + "<br />" +
                  "Cable length: " + e.cable_length + " nm <br />" +
                  "Construction time: " + e.measure_construction_time + "<br />" +
                  "Reviewed: " + e.percentage_reviewed + " %<br />";
              dialog.appendChild(msg);

              $(dialog).dialog({
                height: 440,
                modal: true,
                buttons: {
                  "OK": function() {
                    $(this).dialog("close");
                  }
                }
              });
            }
          }
        }
      });
};

SelectionTable.prototype.highlight = function( skeleton_id ) {
  if (this.selected_skeleton_id in this.skeleton_ids) {
    $('#skeletonrow' + this.widgetID + '-' + this.selected_skeleton_id).css('background-color', 'white');
    this.selected_skeleton_id = null;
  }
  if (skeleton_id in this.skeleton_ids) {
    $('#skeletonrow'+ this.widgetID + '-' + skeleton_id).css('background-color', this.highlighting_color);
    this.selected_skeleton_id = skeleton_id;
  }
};

/** Static access to the first selection table found. */
SelectionTable.prototype.getOrCreate = function() {
  var selection = SelectionTable.prototype.getFirstInstance();
  if (!selection) WindowMaker.create('neuron-staging-area');
  return SelectionTable.prototype.getFirstInstance();
};

SelectionTable.prototype.toggleSelectAllSkeletons = function() {
  this.all_visible = !this.all_visible;
  $("[id^='skeletonshow" + this.widgetID + "-']").attr('checked', this.all_visible);
  $("[id^='skeletonpre" + this.widgetID + "-']").attr('checked', this.all_visible);
  $("[id^='skeletonpost" + this.widgetID + "-']").attr('checked', this.all_visible);
  if (!this.all_visible) {
    $("[id^='skeletontext" + this.widgetID + "-']").attr('checked', this.all_visible);
  }
  this.skeletons.map(function(skeleton) {
    skeleton.setVisible(this.all_visible);
  }, this);
  if (this.linkTarget && this.skeletons.length > 0) {
    this.updateLink(this.skeletons.reduce(function(o, skeleton) {
      o[skeleton.id] = skeleton.clone();
      return o;
    }, {}));
  }
};

SelectionTable.prototype.toggleSelectAllSkeletonsUI = function() {
  if (this.match) {
    this.all_visible = !this.all_visible;
    // Update only skeletons that match the text
    var updated = {};
    this.skeletons.filter(function(skeleton) {
      return skeleton.baseName.indexOf(this.match) > -1;
    }, this).forEach(function(skeleton) {
        // Update checkboxes
        $("#skeletonshow" + this.widgetID + "-" + skeleton.id).attr('checked', this.all_visible);
        $("#skeletonpre" + this.widgetID + "-" + skeleton.id).attr('checked', this.all_visible);
        $("#skeletonpost" + this.widgetID + "-" + skeleton.id).attr('checked', this.all_visible);
        if (!this.all_visible) {
          $("#skeletontext" + this.widgetID + "-" + skeleton.id).attr('checked', this.all_visible);
        }
        // Update model
        skeleton.setVisible(this.all_visible);
        updated[skeleton.id] = skeleton.clone();
      }, this);
    if (this.linkTarget && Object.keys(updated).length > 0) {
      this.updateLink(updated);
    }
  } else {
    this.toggleSelectAllSkeletons();
  }
};

/** Where 'type' is 'pre' or 'post'. */
SelectionTable.prototype.toggleSynapsesUI = function(type) {
  var state = !this.all_synapses_visible[type];
  this.all_synapses_visible[type] = state;
  var skeletons = this.skeletons;
  if (this.match) {
    skeletons = this.skeletons.filter(function(skeleton) {
      return skeleton.baseName.indexOf(this.match) > -1;
    }, this);
  }
  skeletons.forEach(function(skeleton) {
    $("#skeleton" + type + this.widgetID + "-" + skeleton.id).attr('checked', state);
    skeleton[type + "_visible"] = state;
  }, this);
  if (this.linkTarget && skeletons.length > 0) {
    this.updateLink(skeletons.reduce(function(o, skeleton) {
      o[skeleton.id] = skeleton.clone();
      return o;
    }, {}));
  }
};

SelectionTable.prototype.sort = function(sortingFn) {
  this.skeletons.sort(sortingFn);

  // Refresh indices
  this.skeleton_ids = this.skeletons.reduce(function(o, sk, i) {
    o[sk.id] = i;
    return o;
  }, {});

  this.gui.update();
};

SelectionTable.prototype.sortByName = function() {
  this.sort(function(sk1, sk2) {
    var name1 = sk1.baseName.toLowerCase(),
        name2 = sk2.baseName.toLowerCase();
    return name1 == name2 ? 0 : (name1 < name2 ? -1 : 1);
  });

};

/** Sort by hue, then saturation, then luminance. */
SelectionTable.prototype.sortByColor = function() {
  this.sort(function(sk1, sk2) {
    var hsl1 = sk1.color.getHSL(),
        hsl2 = sk2.color.getHSL();
    if (hsl1.h === hsl2.h) {
      if (hsl1.s === hsl2.s) {
        if (hsl1.l === hsl2.l) {
          return 0;
        } else {
          return hsl1.l < hsl2.l ? -1 : 1;
        }
      } else {
        return hsl1.s < hsl2.s ? -1 : 1;
      }
    } else {
      return hsl1.h < hsl2.h ? -1 : 1;
    }
  });
};

/** setup button handlers */
SelectionTable.prototype.init = function() {
  $('#selection-table-remove-all' + this.widgetID).click((function() {
    if (confirm("Remove selected from table?")) {
      this.removeSkeletons(this.getSelectedSkeletons());
    }
  }).bind(this));

  $('#selection-table-show-all' + this.widgetID).click(this.toggleSelectAllSkeletonsUI.bind(this));
  $('#selection-table-show-all-pre' + this.widgetID).click(this.toggleSynapsesUI.bind(this, 'pre'));
  $('#selection-table-show-all-post' + this.widgetID).click(this.toggleSynapsesUI.bind(this, 'post'));

  $('#selection-table-sort-by-name' + this.widgetID).click(this.sortByName.bind(this));
  $('#selection-table-sort-by-color' + this.widgetID).click(this.sortByColor.bind(this));
};

/** sks: object with skeleton_id as keys and neuron names as values. */
SelectionTable.prototype.insertSkeletons = function(sks, callback) {
  var models = {};
  Object.keys(sks).forEach(function(id) {
    models[id] = new this.SkeletonModel(id, sks[id], this.pickColor());
  }, this);
  this.append(models);

  this.gui.update();

  if (callback) callback();
};

SelectionTable.prototype.addSkeletons = function(ids, callback) {
  var skeleton_ids = this.skeleton_ids;
  ids = ids.reduce(function(a, skid) {
    if (!(skid in skeleton_ids)) a.push(parseInt(skid));
    return a;
  }, []);
  var self = this;
  requestQueue.register(django_url + project.id + '/skeleton/neuronnames', 'POST',
    {skids: ids},
    function(status, text) {
      if (200 !== status) return;
      var json = $.parseJSON(text);
      if (json.error) { alert(json.error); return; }
      self.insertSkeletons(json, callback);
    });
};

SelectionTable.prototype.append = function(models) {
  var skeleton_ids = Object.keys(models);
  if (0 === skeleton_ids.length) {
    growlAlert("Info", "No skeletons selected!"); // at source
    return;
  }

  // Retrieve review status before doing anything else
  requestQueue.register(django_url + project.id + '/skeleton/review-status', 'POST',
    {skeleton_ids: skeleton_ids},
    (function(status, text) {
      if (200 !== status) return;
      var json = $.parseJSON(text);
      if (json.error) {
        new ErrorDialog(json.error, json.detail).show();
        return;
      }

      skeleton_ids.forEach(function(skeleton_id) {
        if (skeleton_id in this.skeleton_ids) {
          // Update skeleton
          this.skeletons[this.skeleton_ids[skeleton_id]] = models[skeleton_id];
          return;
        }
        this.skeletons.push(models[skeleton_id]);
        this.reviews[skeleton_id] = parseInt(json[skeleton_id]);
        this.skeleton_ids[skeleton_id] = this.skeletons.length -1;
      }, this);


      this.gui.update();

      this.updateLink(models);
    }).bind(this));
};

/** ids: an array of Skeleton IDs. */
SelectionTable.prototype.removeSkeletons = function(ids) {
  if (1 === ids.length) {
    if (ids[0] in this.skeleton_ids) {
      // Remove element
      this.skeletons.splice(this.skeleton_ids[ids[0]], 1);
      // Edit selection
      if (ids[0] === this.selected_skeleton_id) {
        this.selected_skeleton_id = null;
      }
    }
  } else {
    var ids_set = ids.reduce(function(o, id) { o[id] = null; return o; }, {});
    // Recreate skeletons array
    this.skeletons = this.skeletons.filter(function(sk) {
      return !(sk.id in ids_set);
    });
    // Edit selection
    if (this.selected_skeleton_id in ids_set) {
      this.selected_skeleton_id = null;
    }
  }

  // Recreate map of indices
  this.skeleton_ids = this.skeletons.reduce(function(o, sk, i) {
    o[sk.id] = i;
    return o;
  }, {});

  this.gui.update();

  if (this.linkTarget) {
    // Prevent propagation loop by checking if the target has the skeletons anymore
    if (ids.some(this.linkTarget.hasSkeleton, this.linkTarget)) {
      this.linkTarget.removeSkeletons(ids);
    }
  }
};

SelectionTable.prototype.clear = function(source_chain) {
  this.skeletons = [];
  this.skeleton_ids = {};
  this.reviews = {};
  this.gui.clear();
  this.selected_skeleton_id = null;
  this.next_color_index = 0;

  this.clearLink(source_chain);
};
 
/** Set the color of all skeletons based on the state of the "Color" pulldown menu. */
SelectionTable.prototype.randomizeColorsOfSelected = function() {
  this.next_color_index = 0; // reset
  this.skeletons.filter(this.isSelectedFn())
                .forEach(function(skeleton) {
                  skeleton.color = this.pickColor();
                  this.gui.update_skeleton_color_button(skeleton);
                }, this);
  this.updateLink(this.getSelectedSkeletonModels());
};
 
SelectionTable.prototype.getSkeletonModel = function( id ) {
  if (id in this.skeleton_ids) {
    return this.skeletons[this.skeleton_ids[id]].clone();
  }
};

/** Returns a clone of each model. */
SelectionTable.prototype.getSelectedSkeletonModels = function() {
  return this.skeletons.filter(this.isSelectedFn())
                       .reduce(function(m, sk) { m[sk.id] = sk.clone(); return m; }, {});
};

SelectionTable.prototype.getSkeletonModels = function() {
  return this.skeletons.reduce(function(o, model) {
      o[model.id] = model.clone();
    return o;
  }, {});
};

/** Update neuron names and remove stale non-existing skeletons while preserving
 *  ordering and properties of each skeleton currently in the selection. */
SelectionTable.prototype.update = function() {
  var models = this.skeletons.reduce(function(o, sk) { o[sk.id] = sk; return o; }, {});
  var indices = this.skeleton_ids;
  var self = this;
  requestQueue.register(django_url + project.id + '/skeleton/neuronnames', 'POST',
    {skids: Object.keys(models)},
    function(status, text) {
      if (200 !== status) return;
      var json = $.parseJSON(text);
      var o = {};
      Object.keys(json).forEach(function(skid) {
        o[indices[skid]] = skid;
      });
      var new_models = {};
      self.skeletons = [];
      self.skeleton_ids = {};
      Object.keys(o).map(Number).sort(function(a, b) { return a - b; }).forEach(function(index) {
        var skid = o[index],
            model = models[skid];
        if (model.baseName !== json[skid]) {
          new_models[skid] = model;
          model.baseName = json[skid];
        }
        self.skeletons.push(models[skid]);
        self.skeleton_ids[skid] = self.skeletons.length -1;
      });
      self.gui.update();
      self.updateLink(new_models);
    });
};

SelectionTable.prototype.getSkeletonColor = function( id ) {
  var sk = this.getSkeletonModel(id);
  if (sk) return sk.color.clone();
};

SelectionTable.prototype.isSelectedFn = function() {
  return (this.match ?
      function(sk) { return sk.selected && sk.baseName.indexOf(this.match) > -1; }
    : function(sk) { return sk.selected; }).bind(this);
};

SelectionTable.prototype.getSelectedSkeletons = function() {
  return this.skeletons.filter(this.isSelectedFn())
                       .map(function(s) { return s.id; });
};

SelectionTable.prototype.hasSkeleton = function(skeleton_id) {
  return skeleton_id in this.skeleton_ids;
};

SelectionTable.prototype.getSelectedSkeletonNames = function() {
  return this.skeletons.reduce(function(o, skeleton) {
    if (skeleton.selected) o[skeleton.id] = skeleton.baseName;
    return o;
  }, {});
};

SelectionTable.prototype.setVisible = function(skeleton_ids, visible) {
  skeleton_ids.forEach(function(skid) {
    if (skid in this.skeleton_ids) {
      this.skeletons[this.skeleton_ids[skid]].selected = visible;
    }
  }, this);
  this.gui.update();
};

SelectionTable.prototype.get_all_skeletons = function() {
  return Object.keys( skeleton_ids );
};

SelectionTable.prototype.showPrevious = function() {
  this.gui.showPrevious();
};

SelectionTable.prototype.showNext = function() {
  this.gui.showNext();
};


SelectionTable.prototype.GUI = function(table, max) {
  this.table = table;
  this.first = 0;
  this.max = max;
};

SelectionTable.prototype.GUI.prototype = {};

SelectionTable.prototype.GUI.prototype.clear = function() {
  this.first = 0;
  this.update();
};

SelectionTable.prototype.GUI.prototype.showPrevious = function() {
  if (0 === this.first) return;
  this.first -= this.max;
  this.update();
};

SelectionTable.prototype.GUI.prototype.showNext = function() {
  if (this.first + this.max > this.table.skeletons.length) return;
  this.first += this.max;
  this.update();
};

SelectionTable.prototype.GUI.prototype.update_skeleton_color_button = function(skeleton) {
  $('#skeletonaction-changecolor-' + this.table.widgetID + '-' + skeleton.id).css("background-color", '#' + skeleton.color.getHexString());
};

/** Remove all, and repopulate with the current range. */
SelectionTable.prototype.GUI.prototype.update = function() {

  var skeletons = this.table.skeletons,
      skeleton_ids = this.table.skeleton_ids;

  if (this.table.match) {
    // filter skeletons by the matching string
    skeletons = skeletons.filter(function(skeleton) {
      return skeleton.baseName && skeleton.baseName.indexOf(this.table.match) > -1;
    }, this);
    // recreate the indices
    var i = 0;
    skeleton_ids = skeletons.reduce(function(o, skeleton) {
      o[skeleton.id] = i++;
      return o;
    }, {});
  }

  // Cope with changes in size
  if (this.first >= skeletons.length) {
    this.first = Math.max(0, skeletons.length - this.max);
  }

  // Update GUI state
  var widgetID = this.table.widgetID;
  var one = 0 === skeletons.length? 0 : 1;
  $('#selection_table_first' + widgetID).text(this.first + one);
  $('#selection_table_last' + widgetID).text(Math.min(this.first + this.max + one, skeletons.length));

  var total = this.table.skeletons.length;
  if (this.table.match) {
    total = skeletons.length + " (of " + total + ")";
  }
  $('#selection_table_length' + widgetID).text(total);

  // Remove all table rows
  $("tr[id^='skeletonrow" + widgetID + "']").remove();
  // Re-add the range
  skeletons.slice(this.first, this.first + this.max).forEach(this.append, this);

  // If the active skeleton is within the range, highlight it
  this.selected_skeleton_id = SkeletonAnnotations.getActiveSkeletonId();
  if (this.selected_skeleton_id) this.table.highlight(this.selected_skeleton_id);
};

SelectionTable.prototype.GUI.prototype.append = function (skeleton) {
  var table = this.table,
      widgetID = this.table.widgetID;

  var rowElement = $('<tr/>').attr({
    id: 'skeletonrow' + widgetID + '-' + skeleton.id
  });

  var td = $(document.createElement("td"));
  td.append( $(document.createElement("img")).attr({
    value: 'Nearest node'
  })
    .click( function( event )
    {
      TracingTool.goToNearestInNeuronOrSkeleton( 'skeleton', skeleton.id );
    })
    .attr('src', STATIC_URL_JS + 'widgets/themes/kde/activate.gif')
  );
  td.append( $(document.createElement("img")).attr({
        value: 'Remove'
        })
        .click( function( event )
        {
          table.removeSkeletons( [skeleton.id] );
        })
        .attr('src', STATIC_URL_JS + 'widgets/themes/kde/delete.png')
        .text('Remove!')
  );
  rowElement.append( td );

  rowElement.append(
    $(document.createElement("td")).text( skeleton.baseName + ' #' + skeleton.id )
  );

  // percent reviewed
  rowElement.append($('<td/>')
      .text(this.table.reviews[skeleton.id] + "%")
      .css('background-color',
          ReviewSystem.getBackgroundColor(this.table.reviews[skeleton.id])));

  // show skeleton
  rowElement.append(
    $(document.createElement("td")).append(
      $(document.createElement("input")).attr({
                id:    'skeletonshow' + widgetID + '-' + skeleton.id,
                //name:  skeleton.baseName,
                value: skeleton.id,
                type:  'checkbox',
                checked: skeleton.selected
        })
        .click( function( event )
        {
          var vis = $('#skeletonshow' + widgetID + '-' + skeleton.id).is(':checked')
          skeleton.selected = vis;
          $('#skeletonpre' + widgetID + '-' + skeleton.id).attr({checked: vis});
          skeleton.pre_visible = vis;
          $('#skeletonpost' + widgetID + '-' + skeleton.id).attr({checked: vis});
          skeleton.post_visible = vis;
          if (!vis) {
            // hide text
            $('#skeletontext' + widgetID + '-' + skeleton.id).attr({checked: vis});
            skeleton.text_visible = vis;
          }
          table.notifyLink(skeleton);
        } )
  ));

  // show pre
  rowElement.append(
    $(document.createElement("td")).append(
      $(document.createElement("input")).attr({
                id:    'skeletonpre' + widgetID + '-' + skeleton.id,
                //name:  skeleton.baseName,
                value: skeleton.id,
                type:  'checkbox',
                checked:true
        })
        .click( function( event )
        {
          skeleton.pre_visible = $('#skeletonpre' + widgetID + '-' + skeleton.id).is(':checked');
          table.notifyLink(skeleton);
        } )
  ));

  // show post
  rowElement.append(
    $(document.createElement("td")).append(
      $(document.createElement("input")).attr({
                id:    'skeletonpost' + widgetID + '-' + skeleton.id,
                //name:  skeleton.baseName,
                value: skeleton.id,
                type:  'checkbox',
                checked:true
        })
        .click( function( event )
        {
          skeleton.post_visible = $('#skeletonpost' + widgetID + '-' + skeleton.id).is(':checked');
          table.notifyLink(skeleton);
        } )
  ));

  rowElement.append(
    $(document.createElement("td")).append(
      $(document.createElement("input")).attr({
                id:    'skeletontext' + widgetID + '-' + skeleton.id,
                //name:  skeleton.baseName,
                value: skeleton.id,
                type:  'checkbox',
                checked:false
        })
        .click( function( event )
        {
          skeleton.text_visible = $('#skeletontext' + widgetID + '-' + skeleton.id).is(':checked');
          table.notifyLink(skeleton);
        } )
  ));

  var td = $(document.createElement("td"));
  td.append(
    $(document.createElement("button")).attr({
      value: 'P'
    })
      .click( function( event )
      {
        skeleton.property_dialog();
      })
      .text('P')
  );
  td.append(
    $(document.createElement("button")).attr({
      id: 'skeletonaction-changecolor-' + widgetID + '-' + skeleton.id,
      value: 'color'
    })
      .click( function( event )
      {
        // Select the inner div, which will contain the color wheel
        var sel = $('#color-wheel' + widgetID + '-' + skeleton.id + ' .colorwheel' + skeleton.id);
        if (skeleton.cw) {
          delete skeleton.cw;
          $('#color-wheel' + widgetID + '-' + skeleton.id).hide();
          sel.empty();
        } else {
          var cw = Raphael.colorwheel(sel[0], 150);
          cw.color('#' + skeleton.color.getHexString());
          cw.onchange(function(color) {
            skeleton.color = new THREE.Color().setRGB(parseInt(color.r) / 255.0, parseInt(color.g) / 255.0, parseInt(color.b) / 255.0);
            table.gui.update_skeleton_color_button(skeleton);
            table.notifyLink(skeleton);
          });
          skeleton.cw = cw;
          $('#color-wheel' + widgetID + '-' + skeleton.id).show();
        }
      })
      .text('color')
      .css("background-color", '#' + skeleton.color.getHexString())
  );
  td.append(
    $('<div id="color-wheel' + widgetID + '-' + skeleton.id + '"><div class="colorwheel' + skeleton.id + '"></div></div>')
  );
  td.append(
    $(document.createElement("button")).attr({
      value: 'Info'
    })
      .click( function( event )
      {
        skeleton.skeleton_info();
      })
      .text('Info')
  );

  rowElement.append( td );

  $('#skeleton-table' + widgetID + ' > tbody:last').append( rowElement );
 
  if (skeleton.id === this.table.selected_skeleton_id) {
    this.table.highlight(skeleton.id);
  }
};

SelectionTable.prototype.selectSkeletonById = function(id) {
  if (id in this.skeleton_ids) {
    this.selectSkeleton(this.skeletons[this.skeleton_ids[id]], true);
  }
};

SelectionTable.prototype.selectSkeleton = function( skeleton, vis ) {
  $('#skeletonshow' + this.widgetID + '-' + skeleton.id).attr('checked', vis);
  skeleton.setVisible(vis);
  this.notifyLink(skeleton);
};

SelectionTable.prototype.measure = function() {
  var skids = this.getSelectedSkeletons();
  if (0 === skids.length) return;
  var self = this;
  requestQueue.register(django_url + project.id + '/skeletons/measure', "POST",
    {skeleton_ids: skids},
    function(status, text) {
      if (200 !== status) return;
      var json = $.parseJSON(text);
      if (json.error) {
        alert(json.error);
        return;
      }
      SkeletonMeasurementsTable.populate(json.map(function(row) {
        var model = self.skeletons[self.skeleton_ids[row[0]]];
        row.unshift(model.baseName + ' #' + model.id);
        return row;
      }));
    });
};

SelectionTable.prototype.annotate_skeleton_list = function() {
  var skeleton_ids = this.getSelectedSkeletons();
  NeuronAnnotations.prototype.annotate_neurons_of_skeletons(skeleton_ids);
};

/** Filtering by an empty text resets to no filtering. */
SelectionTable.prototype.filterBy = function(text) {
  if (!text || 0 === text.length) {
    delete this.match;
  } else {
    this.match = text;
    this.first = 0;
  }
  this.gui.update();
};

SelectionTable.prototype.batchColorSelected = function(rgb) {
  var c = [parseInt(rgb.r) / 255.0,
           parseInt(rgb.g) / 255.0,
           parseInt(rgb.b) / 255.0];
  this.getSelectedSkeletons().forEach(function(skid) {
    var skeleton = this.skeletons[this.skeleton_ids[skid]];
    skeleton.color.setRGB(c[0], c[1], c[2]);
    this.gui.update_skeleton_color_button(skeleton);
    this.notifyLink(skeleton); // TODO need a batchNotifyLink
  }, this);
  $('#selection-table-batch-color-button' + this.widgetID)[0].style.backgroundColor = rgb.hex;
};

SelectionTable.prototype.toggleBatchColorWheel = function() {
  var div = $('#selection-table-batch-color-wheel' + this.widgetID + ' .batch-colorwheel-' + this.widgetID);
  if (this.batch_cw) {
    // hide it
    delete this.batch_cw;
    $('#selection-table-batch-color-wheel' + this.widgetID).hide();
    div.empty();
  } else {
    // show it
    this.batch_cw = Raphael.colorwheel(div[0], 150);
    var c = $('#selection-table-batch-color-button' + this.widgetID)[0].style.backgroundColor;
    var rgb = c.substring(c.indexOf('(') + 1, c.lastIndexOf(')')).split(',').map(Number);
    this.batch_cw.color(this._rgbarray2hex(rgb));
    this.batch_cw.onchange(this.batchColorSelected.bind(this));
    $('#selection-table-batch-color-wheel' + this.widgetID).show();
  }
};


/** credit: http://stackoverflow.com/questions/638948/background-color-hex-to-javascript-variable-jquery */
SelectionTable.prototype._rgb2hex = function(rgb) {
  rgb = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
  var hex = function(x) {
    return ("0" + parseInt(x).toString(16)).slice(-2);
  }
  return "#" + hex(rgb[1]) + hex(rgb[2]) + hex(rgb[3]);
};

SelectionTable.prototype._componentToHex = function(c) {
  var hex = c.toString(16);
  return hex.length === 1 ? "0" + hex : hex;
};

SelectionTable.prototype._rgbarray2hex = function(rgb) {
  return "#" + this._componentToHex(rgb[0]) + this._componentToHex(rgb[1]) + this._componentToHex(rgb[2]);
};

SelectionTable.prototype._hex2rgb = function(hex) {
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)];
};
