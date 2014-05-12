/* -*- mode: espresso; espresso-indent-level: 2; indent-tabs-mode: nil -*- */
/* vim: set softtabstop=2 shiftwidth=2 tabstop=2 expandtab: */

"use strict";

var SkeletonConnectivity = function() {
  this.widgetID = this.registerInstance();
  this.registerSource();
  // An ordered list of neurons/skeletons for display
  this.ordered_skeleton_ids = [];
  // An (per se unordered) object mapping skeletonIDs to skeleton names
  this.skeletons = {};
  // Incoming an outgoing connections of current neurons
  this.incoming = {};
  this.outgoing = {};
  // Default table layout to be side by side
  this.tablesSideBySide = true;
  // Default upstream and downstream tables to be not collapsed
  this.upstreamCollapsed = false;
  this.downstreamCollapsed = false;
  // Thresholds for current skeleton set
  this.upThresholds = {};
  this.downThresholds = {};
  // Indicates whether single nodes should be hidden
  this.hideSingleNodePartners = false;
  // ID of the user who is currently reviewing or null for 'union'
  this.reviewFilter = null;
};

SkeletonConnectivity.prototype = {};
$.extend(SkeletonConnectivity.prototype, new InstanceRegistry());
$.extend(SkeletonConnectivity.prototype, new SkeletonSource());

/** Appends only to the top list, that is, the set of seed skeletons
 *  for which all pre- and postsynaptic partners are listed. */
SkeletonConnectivity.prototype.append = function(models) {
  var skeletons = this.skeletons,
      added = 0,
      removed = 0,
      widgetID = this.widgetID;
  var new_skeletons = Object.keys(models).reduce(function(o, skid) {
    var model = models[skid];
    if (skid in skeletons) {
      if (model.selected) {
        // Update name
        skeletons[skid] = model.baseName;
        $('#a-connectivity-table-' + widgetID + '-' + skid).html(model.baseName + ' #' + skid);
      } else {
        // Remove
        delete skeletons[skid];
        ++removed;
      }
    } else {
      if (model.selected) {
        o[skid] = models[skid].baseName;
        ++added;
      }
    }
    return o;
  }, {});

  if (0 === removed && 0 === added) {
    return;
  }
  
  // Update existing ones and add new ones
  $.extend(this.skeletons, new_skeletons);
  for (var skid in new_skeletons) {
    this.ordered_skeleton_ids.push(skid);
  }
  this.update();
  this.updateLink(models);
};

SkeletonConnectivity.prototype.getName = function() {
  return "Connectivity " + this.widgetID;
};

SkeletonConnectivity.prototype.destroy = function() {
  this.unregisterInstance();
  this.unregisterSource();
};

SkeletonConnectivity.prototype.clear = function(source_chain) {
  this.skeletons = {};
  this.ordered_skeleton_ids = [];
  this.upThresholds = {};
  this.downThresholds = {};
  this.update();
  this.clearLink(source_chain);
};

SkeletonConnectivity.prototype.removeSkeletons = function(skeleton_ids) {
  skeleton_ids.forEach(function(skid) {
    delete this.skeletons[skid];
    var index = this.ordered_skeleton_ids.indexOf(skid);
    if (index > -1) {
      this.ordered_skeleton_ids.splice(index, 1);
    }
  }, this);
  this.update();
  this.updateLink(this.getSelectedSkeletonModels());
};

SkeletonConnectivity.prototype.hasSkeleton = function(skeleton_id) {
  return skeleton_id in this.skeletons;
};

SkeletonConnectivity.prototype.updateModels = function(models, source_chain) {
  if (source_chain && (this in source_chain)) return; // break propagation loop
  if (!source_chain) source_chain = {};
  source_chain[this] = this;

  this.append(models);
};

SkeletonConnectivity.prototype.highlight = function(skeleton_id) {
  // TODO color the table row in green if present, clear all others
};

SkeletonConnectivity.prototype.getSelectedSkeletons = function() {
  // TODO refactor to avoid unnecessary operations
  return Object.keys(this.getSelectedSkeletonModels());
};

SkeletonConnectivity.prototype.getSkeletonModel = function(skeleton_id) {
  var e_name = $('#a-connectivity-table-' + this.widgetID + '-' + skeleton_id);
  if (0 === e_name.length) return null;
  var name = e_name.text();
  name = name.substring(0, name.lastIndexOf(' '));

  var pre = $("#presynaptic_to-show-skeleton-" + this.widgetID + "-" + skeleton_id);
  var post = $("#postsynaptic_to-show-skeleton-" + this.widgetID + "-" + skeleton_id);

  var color = new THREE.Color();
  if (pre.length > 0) {
    if (post.length > 0) color.setRGB(0.8, 0.6, 1); // both
    else color.setRGB(1, 0.4, 0.4); // pre
  } else if (post.length > 0) color.setRGB(0.5, 1, 1); // post

  var model = new SelectionTable.prototype.SkeletonModel(skeleton_id, name, color);
  model.selected = pre.is(':checked') || post.is(':checked');
  return model;
};

SkeletonConnectivity.prototype.getSelectedSkeletonModels = function() {
  var widgetID = this.widgetID;
  var skeletons = this.skeletons;
  // Read out skeletons from neuron list
  var models = Object.keys(this.skeletons).reduce(function(o, skid) {
    // Test if checked
    var cb = $('input#neuron-selector-' + widgetID + '-' + skid +
        '[type=checkbox]');
    if (cb.is(':checked')) {
      var name = skeletons[skid];
      name = name.substring(0, name.lastIndexOf(' '));
      o[skid] = new SelectionTable.prototype.SkeletonModel(skid,
          skeletons[skid], new THREE.Color().setRGB(1, 1, 0));
    }
    return o;
  }, {});

  var colors = [new THREE.Color().setRGB(1, 0.4, 0.4),
                new THREE.Color().setRGB(0.5, 1, 1),
                new THREE.Color().setRGB(0.8, 0.6, 1)];
  // Read out all skeletons
  var sks = {};
  ['presynaptic_to', 'postsynaptic_to'].forEach(function(relation, index) {
    $("input[id^='" + relation + "-show-skeleton-" + widgetID + "-']").each(function(i, e) {
      var skid = parseInt(e.value);
      if (!(skid in sks)) sks[skid] = {};
      sks[skid][index] = e.checked;
    });
  });
  // Pick those for which at least one checkbox is checked (if they have more than one)
  Object.keys(sks).forEach(function(skid) {
    var sk = sks[skid];
    if (true === sk[0] || true === sk[1]) {
      var index = -1;
      if (0 in sk) {
        if (1 in sk) index = 2; // exists in both pre and post
        else index = 0;
      } else if (1 in sk) index = 1;
      var name = $('#a-connectivity-table-' + widgetID + '-' + skid).text();
      name = name.substring(0, name.lastIndexOf(' '));
      models[skid] = new SelectionTable.prototype.SkeletonModel(skid, name, colors[index].clone());
    }
  });

  return models;
};

/**
 * Clears the widgets content container.
 */
SkeletonConnectivity.prototype._clearGUI = function() {
  // Clear widget
  $("#connectivity_widget" + this.widgetID).empty();
};

SkeletonConnectivity.prototype.update = function() {
  var skids = Object.keys(this.skeletons);
  if (0 === skids.length) {
    this._clearGUI();
    return;
  };

  // Record the state of checkboxes
  var checkboxes = [{}, {}],
      widgetID = this.widgetID,
      relations = ['presynaptic_to', 'postsynaptic_to'];
  relations.forEach(function(relation, index) {
    $("[id^='" + relation + "-show-skeleton-" + widgetID + "-']").each(function(_, checkbox) {
      checkboxes[index][checkbox.value] = checkbox.checked;
    });
  });

  var self = this;

  requestQueue.replace(
      django_url + project.id + '/skeleton/connectivity',
      'POST',
      {'source': skids,
       'boolean_op': $('#connectivity_operation' + this.widgetID).val()},
      function(status, text) {
        var handle = function(status, text) {
          if (200 !== status) {
            self.incoming = {};
            self.outgoing = {};
            new ErrorDialog("Couldn't load connectivity information",
                "The server returned an unexpected status code: " +
                    status).show();
            return;
          }
          var json = $.parseJSON(text);
          if (json.error) {
            self.incoming = {};
            self.outgoing = {};
            new ErrorDialog("Couldn't load connectivity information",
                json.error).show();
            return;
          }

          // Save reference of incoming and outgoing nodes. These are needed to open
          // the connectivity plots in a separate widget.
          self.incoming = json.incoming;
          self.outgoing = json.outgoing
          // Create connectivity tables
          self.createConnectivityTable();
        };

        // Handle result and create tables, if possible
        handle(status, text);
        // Restore checkbox state
        checkboxes.forEach(function(c, i) {
          var relation = relations[i];
          Object.keys(c).forEach(function(skeleton_id) {
            var sel = $('#' + relation + '-show-skeleton-' + self.widgetID + '-' + skeleton_id);
            if (sel.length > 0) {
              sel.attr('checked', c[skeleton_id]);
            }
          });
        });
      },
      'update_connectivity_table');
};

SkeletonConnectivity.prototype.createConnectivityTable = function() {
  // Simplify access to this widget's ID in sub functions
  var widgetID = this.widgetID;
  // Simplify access to pre-bound skeleton source and instance registry methods
  var getLinkTarget = this.getLinkTarget.bind(this);
  var getSkeletonModel = this.getSkeletonModel.bind(this);

  /**
   * Support function for creating a neuron/skeleton name link element in the
   * neuron list and both pre- and postsynaptic tables.
   */
  var createNameElement = function(name, skeleton_id) {
    var a = document.createElement('a');
    a.appendChild(document.createTextNode(name + ' #' + skeleton_id));
    a.setAttribute('href', '#');
    a.setAttribute('id', 'a-connectivity-table-' + widgetID + '-' + skeleton_id);
    a.onclick = function() {
      TracingTool.goToNearestInNeuronOrSkeleton('skeleton', skeleton_id);
      return false;
    };
    a.onmouseover = onmouseover;
    a.onmouseout = onmouseout;
    a.style.color = 'black';
    a.style.textDecoration = 'none';
    return a;
  };

  /**
   * Support function to updates the layout of the tables.
   */
  var layoutTables = function(sideBySide) {
    incoming.toggleClass('table_container_half', sideBySide);
    incoming.toggleClass('table_container_wide', !sideBySide);
    outgoing.toggleClass('table_container_half', sideBySide);
    outgoing.toggleClass('table_container_wide', !sideBySide);
  };

  /**
   * Helper to get the synpatic count of a skeleton ID dictionary.
   */
  var synaptic_count = function(skids_dict) {
    return Object.keys(skids_dict).reduce(function(sum, skid) {
      return sum + skids_dict[skid];
    }, 0);
  };

  /**
   * Helper to sort an array.
   */
  var to_sorted_array = function(partners) {
    return Object.keys(partners).reduce(function(list, skid) {
      var partner = partners[skid];
      partner['id'] = parseInt(skid);
      partner['synaptic_count'] = synaptic_count(partner.skids);
      list.push(partner);
      return list;
    }, []).sort(function(a, b) {
      return b.synaptic_count - a.synaptic_count;
    });
  };

  var onmouseover = function() { this.style.textDecoration = 'underline'; }
  var onmouseout = function() { this.style.textDecoration = 'none'; };

  /**
   * Support function for selecting a background color based on review state.
   */
  var getBackgroundColor = function(reviewed) {
    if (100 === reviewed) {
      return '#6fff5c';
    } else if (0 === reviewed) {
      return '#ff8c8c';
    } else {
      return '#ffc71d';
    }
  };

  /**
   * Support function for creating a partner table.
   */
  var create_table = function(skids, skeletons, thresholds, partners, title, relation,
      hideSingles, reviewFilter, collapsed, collapsedCallback) {
    /**
     * Helper to handle selection of a neuron.
     */
    var set_as_selected = function(ev) {
      var skelid = parseInt( ev.target.value );
      var checked = $('#' + relation + '-show-skeleton-' + widgetID + '-' + skelid).is(':checked');
      // Update the checkbox for the same skeleton on the other table, if any
      var r = {presynaptic_to: 'postsynaptic_to',
               postsynaptic_to: 'presynaptic_to'}[relation];
      $('#' + r + '-show-skeleton-' + widgetID + '-' + skelid).attr('checked', checked);

      var linkTarget = getLinkTarget();
      if (!linkTarget) return;

      var model = linkTarget.getSkeletonModel(skelid);
      if (checked) {
        if (!model) model = getSkeletonModel(skelid);
        else model.setVisible(true);
        linkTarget.updateOneModel(model);
      } else {
        if (model) {
          model.setVisible(false);
          linkTarget.updateOneModel(model);
        }
      }
    };

    var table = $('<table />').attr('id', 'incoming_connectivity_table' + widgetID)
            .attr('class', 'partner_table');

    /* The table header will be slightly different if there is more than one
     * neuron currently looked at. In this case, the 'syn count' column will
     * have sub columns for the sum and the respective individual columns. */
    var extraCols = skids.length > 1;
    var headerRows = extraCols ? 2 : 1;

    /**
     * Support function to sum up fields of elemends of an array.
     */
    var getSum = function(elements, field) {
      return elements.reduce(function(sum, e) {
        return sum + e[field];
      }, 0);
    }
    // The total synapse count
    var total_synaptic_count = getSum(partners, 'synaptic_count');
    // The total node count
    var total_node_count = getSum(partners, 'num_nodes');

    /**
     * Support function to accumulate the number of reviews for a set of
     * synaptic partners.
     */
    var getNrReviews = function(synPartners, filter) {
      if (filter) {
        return synPartners.reduce(function(sum, e) {
          var reviews = e.reviewed[filter];
          return reviews ? sum + reviews : sum;
        }, 0);
      } else {
        return synPartners.reduce(function(sum, e) {
          return sum + e.union_reviewed;
        }, 0);
      }
    };
    // The total review count
    var total_reviewed = getNrReviews(partners, reviewFilter);

    // The table header
    var thead = $('<thead />');
    table.append( thead );
    var row = $('<tr />')
    row.append( $('<th />').text(title + "stream neuron").attr('rowspan',
        headerRows));
    row.append( $('<th />').text("syn count").attr('rowspan', 1).attr('colspan',
        extraCols ? skids.length + 1 : 1));
    row.append( $('<th />').text("reviewed").attr('rowspan', headerRows));
    row.append( $('<th />').text("node count").attr('rowspan', headerRows));
    row.append( $('<th />').text("select").attr('rowspan', headerRows));
    thead.append( row );
    if (extraCols) {
      row = $('<tr />');
      row.append( $('<th />').text("Sum").attr('rowspan', '1').attr('colspan', '1'));
      skids.forEach(function(s, i) {
        this.append( $('<th />').text(i+1 + ".").attr('rowspan', '1').attr('colspan', '1'));
      }, row);
      thead.append(row);
    }

    // The aggregate row
    row = $('<tr />');
    var titleClass = collapsed ? "extend-box-closed" : "extend-box-open";
    var titleCell = $('<td />').html('<span class="' + titleClass +
            '"></span>ALL (' + partners.length + 'neurons)')
    row.append(titleCell);
    row.append($('<td />').addClass('syncount').text(total_synaptic_count));
    if (extraCols) {
      skids.forEach(function(skid) {
        var count = partners.reduce(function(sum, partner) {
          return sum + (partner.skids[skid] || 0);
        }, 0)
        this.append($('<td />').addClass('syncount').text(count));
      }, row);
    }
    var average = Math.floor(100 * total_reviewed / total_node_count) | 0;
    row.append( $('<td />').text(average + "%")
        .css('background-color', getBackgroundColor(average)));
    row.append( $('<td />').text(total_node_count));
    var el = $('<input type="checkbox" id="' + title.toLowerCase() + 'stream-selectall' +  widgetID + '" />');
    row.append( $('<td />').addClass('input-container').append( el ) );
    thead.append(row);

    var tbody = $('<tbody />');
    table.append( tbody );
    if (collapsed) {
      tbody.css('display', "none");
    }

    // Add handler to first row
    titleCell.click((function(element) {
      return function() {
        var $title = $(this);
        // Toggle visibility of the complete table body
        element.toggle(200, function() {
          // Change open/close indidicator box
          var open_elements = $(".extend-box-open", $title);
          if (open_elements.length > 0) {
            open_elements.attr('class', 'extend-box-closed');
          } else {
            var close_elements = $(".extend-box-closed", $title);
            if (close_elements.length > 0) {
              close_elements.attr('class', 'extend-box-open');
            }
          }
        });
        // Call back, if wanted
        if (collapsedCallback) {
          collapsedCallback();
        }
      };
    })(tbody));

    /**
     * Support function to add a table cell that links to a connector selection,
     * displaying a connector count.
     */
    function createSynapseCountCell(count, partner, skids, title) {
      var td = document.createElement('td');
      td.setAttribute('class', 'syncount');
      var a = document.createElement('a');
      td.appendChild(a);
      a.appendChild(document.createTextNode(count));
      a.setAttribute('href', '#');
      a.style.color = 'black';
      a.style.textDecoration = 'none';
      //showSharedConnectorsFn(partner.id, Object.keys(partner.skids), relation);
      a.onclick = ConnectorSelection.show_shared_connectors.bind(
          ConnectorSelection, partner.id, skids, relation);
      a.onmouseover = function() {
          a.style.textDecoration = 'underline';
          // TODO should show a div with the list of partners, with their names etc.
      };
      a.onmouseout = onmouseout;
      // Create tool-tip
      a.setAttribute('title', title)
      td.setAttribute('title', title)
      return td;
    };

    // Create a table row for every partner and remember the ignored ones
    var filtered = partners.reduce(function(filtered, partner) {
      // Ignore this line if all its synapse counts are below the threshold. If
      // the threshold is 'undefined', false is returned and to semantics of
      // this test.
      var ignore = Object.keys(partner.skids).every(function(skid) {
        // Return true if object is below threshold
        return (partner.skids[skid] || 0) < thresholds[skid];
      });
      ignore = ignore || partner.synaptic_count < thresholds['sum'];
      // Ignore partner if it has only a single node, if requested
      if (hideSingles) {
        ignore = ignore || partner.num_nodes == 1;
      }
      if (ignore) {
        filtered.push(partner);
        return filtered;
      }

      var tr = document.createElement('tr');
      tbody.append(tr);

      // Cell with partner neuron name
      var td = document.createElement('td');
      var a = createNameElement(partner.name, partner.id);
      td.appendChild(a);
      tr.appendChild(td);

      // Cell with synapses with partner neuron
      tr.appendChild(createSynapseCountCell(partner.synaptic_count,
          partner, Object.keys(partner.skids), partner.synaptic_count +
          " synapses for all selected neurons."));
      // Extra columns for individual neurons
      if (extraCols) {
        skids.forEach(function(skid, i) {
          var count = partner.skids[skid] || 0;
          this.appendChild(createSynapseCountCell(count, partner, [skid],
              count + " synapses for neuron '" + skeletons[skid]  + "."));
        }, tr);
      }

      // Cell with percent reviewed of partner neuron
      var pReviewed = parseInt(Math.floor((100 *
          getNrReviews([partner], reviewFilter) / partner.num_nodes)));
      var td = document.createElement('td');
      td.appendChild(document.createTextNode(pReviewed + "%"));
      td.style.backgroundColor = getBackgroundColor(pReviewed);
      tr.appendChild(td);

      // Cell with number of nodes of partner neuron
      var td = document.createElement('td');
      td.appendChild(document.createTextNode(partner.num_nodes));
      tr.appendChild(td);

      // Cell with checkbox for adding to Selection Table
      var td = document.createElement('td');
      td.setAttribute('class', 'input-container');
      var input = document.createElement('input');
      input.setAttribute('id', relation + '-show-skeleton-' + widgetID + '-' + partner.id);
      input.setAttribute('type', 'checkbox');
      input.setAttribute('value', partner.id);
      input.onclick = set_as_selected;
      td.appendChild(input);
      tr.appendChild(td);

      return filtered;
    }, []);

    // If some partners have been filtered (e.g. due to thresholding, hidden
    // one-node-neurons), add another table row to provide information about
    // this.
    if (filtered.length > 0) {
      // The filtered synapse count
      var filtered_synaptic_count = getSum(filtered, 'synaptic_count');
      // The filtered review count
      var filtered_reviewed = getSum(filtered, 'reviewed');
      // The filtered node count
      var filtered_node_count = getSum(filtered, 'num_nodes');
      // Build the row
      var $tr = $('<tr />')
          .append($('<td />').append('Hidden partners'))
          // Synapse count sum column
          .append($('<td />').addClass('syncount')
              .append(filtered_synaptic_count));
      // Synapse count single neuron columns
      if (extraCols) {
        skids.forEach(function(skid, i) {
          var count = filtered.reduce(function(sum, partner) {
            return sum + (partner.skids[skid] || 0);
          }, 0)
          $tr.append($('<td />').addClass('syncount').append(count));
        });
      }
      // Review column
      $tr.append($('<td />').append((filtered_reviewed / filtered.length) | 0));
      // Node count column
      $tr.append($('<td />').append(filtered_node_count));
      // Select column
      $tr.append($('<td />'));

      // Add column to footer of table
      $(table).append($('<tfoot />').append($tr));
    }

    return table;
  };

  /**
   * Support function to add a 'seclect all' checkbox.
   */
  var add_select_all_fn = function(name, table, nSkeletons) {
    // Offset of checkbox column due to extra columns.
    var cbOffset = nSkeletons > 1 ? nSkeletons : 0;
    // Assign 'select all' checkbox handler
    $('#' + name + 'stream-selectall' + widgetID).click(function( event ) {
      var rows = table[0].childNodes[1].childNodes; // all tr elements
      var linkTarget = getLinkTarget();

      var skids = [];
      for (var i=rows.length-1; i > -1; --i) {
        var checkbox = rows[i].childNodes[4 + cbOffset].childNodes[0];
        checkbox.checked = this.checked;
        skids.push(parseInt(checkbox.value));
      };

      if (this.checked) {
       if (linkTarget) {
         linkTarget.updateModels(skids.reduce(function(o, skid) {
           // See if the target has the model and update only its selection state
           var model = linkTarget.getSkeletonModel(skid);
           if (!model) model = getSkeletonModel(skid);
           else model.setVisible(true);
           o[skid] = model;
           return o;
         }, {}));
       }
     } else {
       if (linkTarget) {
         linkTarget.updateModels(skids.reduce(function(o, skid) {
           var model = linkTarget.getSkeletonModel(skid);
           if (!model) return o;
           model.setVisible(false);
           o[skid] = model;
           return o;
         }, {}));
       }
     }
    });
  };

  /**
   * Support function to create a threshold selector element.
   */
  var createThresholdSelector = function(id, selected, max) {
    var select = $('<select />');
    for (var i=1; i < max; ++i) {
      var option = $('<option />').val(i).text(i);
      if (selected === i) {
        option.attr('selected', 'selected');
      }
      select.append(option);
    }
    return select;
  };

  // Clear table
  this._clearGUI();

  // The content container
  var content = $("#connectivity_widget" + widgetID);

  // Create list of selected neurons
  var neuronTable = $('<table />').attr('class', 'header left')
        .append($('<thead />').append($('<tr />')
            .append($('<th />'))
            .append($('<th />').text('Selected'))
            .append($('<th />').text('Neuron'))
            .append($('<th />').text('Upstream Threshold'))
            .append($('<th />').text('Downstream Threshold'))));
  // Add a row for each neuron looked at
  this.ordered_skeleton_ids.forEach(function(skid, i) {
    var id = this.widgetID + '-' + skid;
    var $upThrSelector = createThresholdSelector('neuron-up-threshold-' + id,
        this.upThresholds[skid] || 1, 21);
    var $downThrSelector = createThresholdSelector('neuron-down-threshold-' + id,
        this.downThresholds[skid] || 1, 21)
    // Create and attach handlers to threshold selectors. Generate the function
    // to avoid the creation of a closure.
    $upThrSelector.change((function(widget, skid) {
      return function() {
        widget.upThresholds[skid] = parseInt(this.value);
        widget.createConnectivityTable();
      };
    })(this, skid));
    $downThrSelector.change((function(widget, skid) {
      return function() {
        widget.downThresholds[skid] = parseInt(this.value);
        widget.createConnectivityTable();
      };
    })(this, skid));

    // Create and append row for current skeleton
    var row = $('<tr />')
        .append($('<td />').append((i + 1) + '.'))
        .append($('<td />').attr('class', 'input-container')
            .append($('<input />')
                .attr('id', 'neuron-selector-' + id)
                .attr('type', 'checkbox').attr('checked', 'checked')))
        .append($('<td />').append(
            createNameElement(this.skeletons[skid], skid)))
        .append($('<td />').append($upThrSelector)
            .attr('class', 'input-container'))
        .append($('<td />').append($downThrSelector)
            .attr('class', 'input-container'));
    neuronTable.append(row);
  }, this);
  content.append(neuronTable);
  // If there is more than one neuron looked at, add a sum row
  if (this.ordered_skeleton_ids.length > 1) {
    var id = this.widgetID + '-sum';
    var $upThrSelector = createThresholdSelector('neuron-up-threshold-' + id,
        this.upThresholds['sum'] || 1, 21);
    var $downThrSelector = createThresholdSelector('neuron-down-threshold-' + id,
        this.downThresholds['sum'] || 1, 21)
    // Create and attach handlers to threshold selectors. Generate the function
    // to avoid the creation of a closure.
    $upThrSelector.change((function(widget) {
      return function() {
        widget.upThresholds['sum'] = parseInt(this.value);
        widget.createConnectivityTable();
      };
    })(this));
    $downThrSelector.change((function(widget, skid) {
      return function() {
        widget.downThresholds['sum'] = parseInt(this.value);
        widget.createConnectivityTable();
      };
    })(this));
    // Create and append footer for current skeleton
    var row = $('<tfoot />').append($('<tr />')
        .append($('<td />'))
        .append($('<td />'))
        .append($('<td />').text('Sum'))
        .append($('<td />').append($upThrSelector)
            .attr('class', 'input-container'))
        .append($('<td />').append($downThrSelector)
            .attr('class', 'input-container')));
    neuronTable.append(row);
  }

  // Add a separate table settings container
  var tableSettings = $('<div />').attr('class', 'header');
  content.append(tableSettings);

  // Add a checkbox to toggle display of single-node neurons
  var singleNeuronToggle = $('<input />').attr('type', 'checkbox')
      .change((function(widget) {
        return function() {
          widget.hideSingleNodePartners = this.checked;
          widget.createConnectivityTable();
        };
      })(this));
  if (this.hideSingleNodePartners) {
    singleNeuronToggle.attr('checked', 'checked');
  }
  var singleNeuronToggleContainer = $('<label />')
      .attr('class', 'left')
      .append(singleNeuronToggle)
      .append('Hide single node partners');
  tableSettings.append(singleNeuronToggleContainer);

  // Add a drop-down menu to select a review focus. It defaults to 'Union'
  // if nothing else was selected before.
  var reviewFilter = $('<select />')
      .append($('<option />').attr('value', 'union').append('All (union)'))
      .change((function(widget) {
        return function() {
          widget.reviewFilter = this.value === 'union' ? null : this.value;
          widget.createConnectivityTable();
        };
      })(this));
  // Support function to extract reviewer IDs from partners
  var collectReviewers = function(o, collection) {
    for (var p in o) {
      if (o.hasOwnProperty(p)) {
        for (var r in o[p].reviewed) {
          r = parseInt(r);
          if (o[p].reviewed.hasOwnProperty(r) && collection.indexOf(r) === -1) {
            collection.push(r);
          }
        }
      }
    }
  };
  // Get reviewer IDs
  var reviewers = [];
  collectReviewers(this.incoming, reviewers);
  collectReviewers(this.outgoing, reviewers);
  // Build select options
  reviewers.forEach(function(r) {
    var u = User.all()[r];
    var opt = $('<option />').attr('value', r).append(u ? u.fullName : r);
    if (this.reviewFilter == r) {
      opt.attr('selected', 'selected')
    }
    reviewFilter.append(opt);
  }, this);
  var reviewFilterContainer = $('<label />')
      .attr('class', 'right')
      .append('Reviewed by')
      .append(reviewFilter);
  tableSettings.append(reviewFilterContainer);

  // Create containers for pre and postsynaptic partners
  var incoming = $('<div />');
  var outgoing = $('<div />');
  var tables = $('<div />').css('width', '100%').attr('class', 'content')
     .append(incoming)
     .append(outgoing);
  content.append(tables);
  layoutTables(this.tablesSideBySide);

  // Add handler to layout toggle
  $('#connectivity-layout-toggle-' + widgetID).unbind('change')
      .change((function(widget) {
        return function() {
          widget.tablesSideBySide = this.checked;
          layoutTables(this.checked);
        };
      })(this));

  // Create incomining and outgoing tables
  var table_incoming = create_table(this.ordered_skeleton_ids, this.skeletons,
      this.upThresholds, to_sorted_array(this.incoming), 'Up', 'presynaptic_to',
      this.hideSingleNodePartners, this.reviewFilter, this.upstreamCollapsed,
      (function() {
        this.upstreamCollapsed = !this.upstreamCollapsed;
      }).bind(this));
  var table_outgoing = create_table(this.ordered_skeleton_ids, this.skeletons,
      this.downThresholds, to_sorted_array(this.outgoing), 'Down', 'postsynaptic_to',
      this.hideSingleNodePartners, this.reviewFilter, this.downstreamCollapsed,
      (function() {
        this.downstreamCollapsed = !this.downstreamCollapsed;
      }).bind(this));

  incoming.append(table_incoming);
  outgoing.append(table_outgoing);

  // Add 'select all' checkboxes
  var nSkeletons = Object.keys(this.skeletons).length;
  add_select_all_fn('up', table_incoming, nSkeletons);
  add_select_all_fn('down', table_outgoing, nSkeletons);
};

SkeletonConnectivity.prototype.openPlot = function() {
  if (0 === Object.keys(this.skeletons).length) {
    alert("Load at least one skeleton first!");
    return;
  }
  // Create a new connectivity graph plot and hand it to the window maker to
  // show it in a new widget.
  var GP = new ConnectivityGraphPlot(this.skeletons, this.incoming,
      this.outgoing);
  WindowMaker.create('connectivity-graph-plot', GP);
  GP.draw();
};

/**
 * A small widget to display a graph, plotting the number of upstream/downstream
 * partners against the number of synapses. A list of skeleton_ids has to be
 * passed to the constructor to display plots for these skeletons right away.
 */
var ConnectivityGraphPlot = function(skeletons, incoming, outgoing) {
  this.skeletons = skeletons;
  this.incoming = incoming;
  this.outgoing = outgoing;
  this.widgetID = this.registerInstance();
};

ConnectivityGraphPlot.prototype = {};
$.extend(ConnectivityGraphPlot.prototype, new InstanceRegistry());

/**
 * Return name of this widget.
 */
ConnectivityGraphPlot.prototype.getName = function() {
	return "Connectivity Graph Plot " + this.widgetID;
};

/**
 * Custom destroy handler, that deletes all fields of this instance when called.
 */
ConnectivityGraphPlot.prototype.destroy = function() {
  this.unregisterInstance();
  Object.keys(this).forEach(function(key) { delete this[key]; }, this);
};

/**
 * Custom resize handler, that redraws the graphs when called.
 */
ConnectivityGraphPlot.prototype.resize = function() {
  this.draw();
};

/**
 * Makes the browser download the upstream and downstream SVGs as two separate
 * files.
 */
ConnectivityGraphPlot.prototype.exportSVG = function() {
  var div = document.getElementById('connectivity_graph_plot_div' + this.widgetID);
  if (!div) return;
  var images = div.getElementsByTagName('svg');
  if (!images || images.length != 2) {
    alert("Couldn't find expected number of images");
    return;
  }
  // Export upstream image
  var xml = new XMLSerializer().serializeToString(images[0]);
  var blob = new Blob([xml], {type : 'text/xml'});
  saveAs(blob, 'upstream_connectivity_chart.svg');
  // Export downstream image
  xml = new XMLSerializer().serializeToString(images[1]);
  blob = new Blob([xml], {type : 'text/xml'});
  saveAs(blob, 'downstream_connectivity_chart.svg');
};

/**
 * Creates two distribution d3 plots, one for up stream and the other ones for
 * downstream neurons.
 */
ConnectivityGraphPlot.prototype.draw = function() {
  /**
   * Generate a distribution of number of Y partners that have X synapses, for
   * each partner. The distribution then takes the form of an array of blocks,
   * where every block is an array of objects like {skid: <skeleton_id>,
   * count: <partner count>}.  The skeleton_node_count_threshold is used to
   * avoid skeletons whose node count is too small, like e.g. a single node.
   */
  var distribution = function(partners, skeleton_node_count_threshold) {
    var d = Object.keys(partners)
        .reduce(function(ob, partnerID) {
          var props = partners[partnerID];
          if (props.num_nodes < skeleton_node_count_threshold) {
            return ob;
          }
          var skids = props.skids;
          return Object.keys(skids)
              .reduce(function(ob, skid) {
                if (!ob.hasOwnProperty(skid)) ob[skid] = [];
                var synapse_count = skids[skid];
                if (!ob[skid].hasOwnProperty(synapse_count)) {
                  ob[skid][synapse_count] = 1;
                } else {
                  ob[skid][synapse_count] += 1;
                }
                return ob;
              }, ob);
          }, {});

    // Find out which is the longest array
    var max_length = Object.keys(d).reduce(function(length, skid) {
      return Math.max(length, d[skid].length);
    }, 0);

    /* Reformat to an array of arrays where the index of the array is the
     * synaptic count minus 1 (arrays are zero-based), and each inner array
     * has objects with {skid, count} keys. */
    var a = [];
    var skids = Object.keys(d);
    for (var i = 1; i < max_length; ++i) {
      a[i-1] = skids.reduce(function(block, skid) {
        var count = d[skid][i];
        if (count) block.push({skid: skid, count: count});
        return block;
      }, []);
    }

    return a;
  };

  /**
   * A multiple bar chart that shows the number of synapses vs the number of
   * partners that receive/make that many synapses from/onto the skeletons
   * involved (the active or the selected ones).
   */
  var makeMultipleBarChart = function(skeletons, partners, container, title,
        container_width) {
    // Cancel drawing if there is no data
    if (0 === Object.keys(partners).length) return null;

    // Prepare data: (skip skeletons with less than 2 nodes)
    var a = distribution(partners, 2);

    // The skeletons involved (the active, or the selected and visible)
    var skids = Object.keys(a.reduce(function(unique, block) {
      if (block) block.forEach(function(ob) { unique[ob.skid] = null; });
      return unique;
    }, {}));

    if (0 === skids.length) return null;

    // Colors: an array of hex values
    var zeroPad = function(s) { return ("0" + s).slice(-2); }
    var colors = skids.reduce(function(array, skid, i) {
      // Start at Red 255, decrease towards 0
      //          Green 100, increase towards 255
      //          Blue 200, decrease towards 50
      var ratio = (skids.length - i) / skids.length;
      var red = 255 * ratio;
      var green = 100 + 155 * (1 - ratio);
      var blue = 50 + 150 * ratio;
      array.push("#"
          + zeroPad(Number(red | 0).toString(16))
          + zeroPad(Number(green | 0).toString(16))
          + zeroPad(Number(blue | 0).toString(16))); // as hex
      return array;
    }, []);

    // Don't let the canvas be less than 400px wide
    if (container_width < 400) {
      container_width = 400;
    }

    // The SVG element representing the plot
    var margin = {top: 20, right: 20, bottom: 30, left: 40},
        width = container_width - margin.left - margin.right,
        height = container_width / 2 - margin.top - margin.bottom;

    var svg = d3.select(container).append("svg")
        .attr("id", "connectivity_plot_" + title) // already has widgetID in it
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    // Define the data domains/axes
    var x0 = d3.scale.ordinal().rangeRoundBands([0, width], .1);
    var x1 = d3.scale.ordinal();
    var y = d3.scale.linear().range([height, 0]);
    var xAxis = d3.svg.axis().scale(x0)
                             .orient("bottom");
    // "d" means integer, see
    // https://github.com/mbostock/d3/wiki/Formatting#wiki-d3_format
    var yAxis = d3.svg.axis().scale(y)
                             .orient("left")
                             .tickFormat(d3.format("d"));

    // Define the ranges of the axes
    // x0: For the counts of synapses
    x0.domain(a.map(function(block, i) { return i+1; }));
    // x1: For the IDs of the skeletons within each synapse count bin
    x1.domain(skids).rangeRoundBands([0, x0.rangeBand()]);
    // y: the number of partners that have that number of synapses
    var max_count = a.reduce(function(c, block) {
      return block.reduce(function(c, sk) {
        return Math.max(c, sk.count);
      }, c);
    }, 0);
    y.domain([0, max_count]);

    // Color for the bar chart bars
    var color = d3.scale.ordinal().range(colors);

    // Insert the data
    var state = svg.selectAll(".state")
        .data(a)
      .enter().append('g')
        .attr('class', 'g')
        // x0(i+1) has a +1 because the array is 0-based
        .attr('transform', function(a, i) { return "translate(" + x0(i+1) + ", 0)"; });

    // Define how each bar of the bar chart is drawn
    state.selectAll("rect")
        .data(function(block) { return block; })
      .enter().append("rect")
        .attr("width", x1.rangeBand())
        .attr("x", function(sk) { return x1(sk.skid); })
        .attr("y", function(sk) { return y(sk.count); })
        .attr("height", function(sk) { return height - y(sk.count); })
        .style("fill", function(sk) { return color(sk.skid); });

    // Insert the graphics for the axes (after the data, so that they draw on top)
    svg.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + height + ")")
        .call(xAxis)
      .append("text")
        .attr("x", width)
        .attr("y", -6)
        .style("text-anchor", "end")
        .text("N synapses");

    svg.append("g")
        .attr("class", "y axis")
        .call(yAxis)
      .append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 6)
        .attr("dy", ".71em")
        .style("text-anchor", "end")
        .text("N " + title + " Partners");

    // The legend: which skeleton is which
    var legend = svg.selectAll(".legend")
        .data(skids.map(function(skid) { return skeletons[skid]; } ))
      .enter().append("g")
        .attr("class", "legend")
        .attr("transform", function(d, i) { return "translate(0," + i * 20 + ")"; });

    legend.append("rect")
        .attr("x", width - 18)
        .attr("width", 18)
        .attr("height", 18)
        .style("fill", color);

    legend.append("text")
        .attr("x", width - 24)
        .attr("y", 9)
        .attr("dy", ".35em")
        .style("text-anchor", "end")
        .text(function(d) { return d; });
  };

  // Clear existing plot, if any
  var containerID = '#connectivity_graph_plot_div' + this.widgetID;
  var container = $(containerID);
  container.empty();

  // Draw plots
  makeMultipleBarChart(this.skeletons, this.incoming, containerID,
      "Upstream" + this.widgetID, container.width());
  makeMultipleBarChart(this.skeletons, this.outgoing, containerID,
      "Downstream" + this.widgetID, container.width());
};
