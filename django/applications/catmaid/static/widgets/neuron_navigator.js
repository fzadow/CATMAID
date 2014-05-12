/* -*- mode: espresso; espresso-indent-level: 2; indent-tabs-mode: nil -*- */
/* vim: set softtabstop=2 shiftwidth=2 tabstop=2 expandtab: */

"use strict";

var NeuronNavigator = function()
{
  this.widgetID = this.registerInstance();
  this.registerSource();
  this.current_node = null;
};

NeuronNavigator.prototype = {};
$.extend(NeuronNavigator.prototype, new InstanceRegistry());
$.extend(NeuronNavigator.prototype, new SkeletonSource());

/* Implement interfaces */

NeuronNavigator.prototype.getName = function()
{
    return "Neuron Navigator " + this.widgetID;
};

NeuronNavigator.prototype.destroy = function()
{
  this.unregisterInstance();
  this.unregisterSource();
};

NeuronNavigator.prototype.append = function() {};
NeuronNavigator.prototype.clear = function(source_chain) {};
NeuronNavigator.prototype.removeSkeletons = function() {};
NeuronNavigator.prototype.updateModels = function() {};

NeuronNavigator.prototype.getSelectedSkeletons = function()
{
  return this.current_node.getSelectedSkeletons();
};

NeuronNavigator.prototype.hasSkeleton = function(skeleton_id)
{
  return this.current_node.hasSkeleton(skeleton_id);
};

NeuronNavigator.prototype.getSelectedSkeletonModels = function()
{
  return this.current_node.getSelectedSkeletonModels();
};

NeuronNavigator.prototype.highlight = function(skeleton_id)
{
  if (!skeleton_id) return;
  this.current_node.highlight(skeleton_id);
};

/* Non-interface methods */

NeuronNavigator.prototype.init_ui = function(container)
{
  // Create a navigation bar to see the current path of nodes
  var navigation_bar = document.createElement('div');
  navigation_bar.setAttribute('id', 'navigator_navi_bar' + this.widgetID);
  navigation_bar.setAttribute('class', 'navigator_navi_bar');
  container.appendChild(navigation_bar);

  // Create a container where all the content of every node will be placed in
  var content = document.createElement('div');
  content.setAttribute('id', 'navigator_content' + this.widgetID);
  content.setAttribute('class', 'navigator_content');
  container.appendChild(content);

  // Add home node as starting point without any parent
  var home_node = new NeuronNavigator.HomeNode(this.widgetID);
  home_node.link(this, null);
  this.select_node(home_node);
};

NeuronNavigator.prototype.set_annotation_node = function(
    annotation_name, annotation_id)
{
  // Create a home node, an annotation list node an an actual annotation node.
  var home_node = new NeuronNavigator.HomeNode(this.widgetID);
  home_node.link(this, null);
  var al_node = new NeuronNavigator.AnnotationListNode();
  al_node.link(this, home_node);
  var a_node = new NeuronNavigator.AnnotationFilterNode(
      annotation_name, annotation_id, false, false);
  a_node.link(this, al_node);
  // Select the annotation node
  this.select_node(a_node);
};

NeuronNavigator.prototype.select_node = function(node)
{
  // Remember this node as the current node
  this.current_node = node;

  // Set the navigation bar contents
  var $navi_bar = $('#navigator_navi_bar' + this.widgetID).empty();
  $navi_bar.append(node.create_path(this));

  // Create a container where all the content of every node will be placed in
  var duplicate_button = document.createElement('div');
  duplicate_button.setAttribute('class', 'navigator_button');
  var duplicate_image = document.createElement('img');
  duplicate_image.setAttribute('src', STATIC_URL_JS +
      'widgets/themes/kde/duplicate_navigator.png');
  duplicate_button.setAttribute('title', 'Duplicate navigator window');
  duplicate_button.appendChild(duplicate_image);
  $navi_bar.append(duplicate_button);
  $(duplicate_image).on('click', this.duplicate.bind(this));

  // Create a re-root button to remove all filters not in effect
  var reroot_button = document.createElement('div');
  reroot_button.setAttribute('class', 'navigator_button');
  var reroot_image = document.createElement('img');
  reroot_image.setAttribute('src', STATIC_URL_JS +
      'widgets/themes/kde/reroot_navigator.png');
  reroot_button.setAttribute('title',
      'Remove all nodes not needed for current view');
  reroot_button.appendChild(reroot_image);
  $navi_bar.append(reroot_button);
  $(reroot_image).on('click', this.reroot.bind(this));

  // Clear the content div, and let the node add content to it
  var $content = $('#navigator_content' + this.widgetID).empty();

  // Get the current filter set and add content based on it
  node.add_content($content, this.current_node.get_filter_set());

  // Update sync link
  this.updateLink(this.getSelectedSkeletonModels());
};

/**
 *  With the help of the duplicate method, the whole navigator is cloned. It
 *  produces a new window with the same content as the first navigator.
 */
NeuronNavigator.prototype.duplicate = function()
{
  var NN = new NeuronNavigator();
  // Clone the current node (and its parents)
  var cloned_node = this.current_node.clone(NN);
  // Create a new window, based on the newly created navigator
  WindowMaker.create('neuron-navigator', NN);
  // Select the cloned node in the new navigator
  NN.select_node(cloned_node);
};

/**
 * The reroot method removes all nodes of the current chain that don't add any
 * filtering effect.
 */
NeuronNavigator.prototype.reroot = function()
{
  // Find the last break in the filter chain
  var node = this.current_node;
  while (node.parent_node) {
    if (node.breaks_filter_chain()) {
      break;
    }
    node = node.parent_node;
  }
  // Only create a new home node if we didn't reach the actual home node.
  if (node.parent_node) {
    // Add home node as starting point without any parent
    var home_node = new NeuronNavigator.HomeNode(this.widgetID);
    home_node.link(this, null);
    // Prune node path to this node
    node.parent_node = home_node;
  }
  // Refresh the current node
  this.select_node(this.current_node);
};

/**
 * A class representing a node in the graph of the navigator.
 */
NeuronNavigator.Node = function(name)
{
  this.name = name;
  this.navigator = null;

  /* Because some nodes use tables to display data, some common options are
   * kept on the abstract node level.
   */
  this.possibleLengths = [25, 100, 500, 2000];
  this.possibleLengthsLabels = this.possibleLengths.map(
      function (n) { return n.toString() });
};

/**
 * Default implementation for getting information for the skeleton source
 * interface. It can be overridden by base classes.
 */
NeuronNavigator.Node.prototype.getSelectedSkeletons = function() {
  return [];
};

/**
 * Default implementation for getting information for the skeleton source
 * interface. It can be overridden by base classes.
 */
NeuronNavigator.Node.prototype.hasSkeleton = function(skeleton_id) {
  return false;
};

/**
 * Default implementation for getting information for the skeleton source
 * interface. It can be overridden by base classes.
 */
NeuronNavigator.Node.prototype.getSelectedSkeletonModels = function()
{
  return {};
};

/**
 * Default implementation for getting information for the skeleton source
 * interface. It can be overridden by base classes.
 */
NeuronNavigator.Node.prototype.highlight = function(skeleton_id)
{
  return;
};

NeuronNavigator.Node.prototype.link = function(navigator, parent_node)
{
  this.navigator = navigator;
  this.parent_node = parent_node;
};

NeuronNavigator.Node.prototype.clone = function(new_navigator)
{
  // Create a new object and make sure the clone has the
  // same prototype as the original.
  var clone = Object.create(Object.getPrototypeOf(this));
  // Copy over all fields that are not-part of the prototype chain
  for (var key in this) {
    if (this.hasOwnProperty(key)) {
      // Ignore navigator and parent node fields for cloning as they
      // are set later anyway.
      if (key !== 'navigator' && key !== 'parent_node') {
        clone[key] = deepCopy(this[key]);
      }
    }
  }
  clone.navigator = new_navigator;

  // Clone the parent as well
  if (this.parent_node) {
    clone.parent_node = this.parent_node.clone(new_navigator);
  } else {
    clone.parent_node = null;
  }

  return clone;
};

NeuronNavigator.Node.prototype.create_path = function()
{
  var path_link = document.createElement('a');
  path_link.setAttribute('href', '#');
  path_link.setAttribute('class', 'navigator_navi_bar_element');
  path_link.innerHTML = this.name;
  $(path_link).click($.proxy(function() {
    this.navigator.select_node(this);
  }, this));

  if (this.parent_node) {
    var path_elements = this.parent_node.create_path();
    var delimiter = this.breaks_filter_chain() ? '|' : '>';
    path_elements.push(document.createTextNode(" " + delimiter + " "));
    path_elements.push(path_link);
    return path_elements;
  } else {
    return [path_link];
  }
};

/**
 * Collect filters of this and upstream nodes. This node adds all the known
 * filters to a single object and puts it into a list, followed by the object
 * from nodes coming before it.
 */
NeuronNavigator.Node.prototype.collect_filters = function()
{
  var filter = {};

  filter.annotation_id = this.annotation_id || null;
  filter.neuron_id = this.neuron_id || null;
  filter.user_id = this.user_id || null;

  if (this.is_meta) {
    filter.is_meta = true;
    if (this.annotates) {
      filter.annotates = true;
    }
  }

  if (this.parent_node && !this.breaks_filter_chain()) {
    return [filter].concat(this.parent_node.collect_filters());
  }

  return [filter];
};

/**
 * Get the filter set valid for the current node. This consists of collecting
 * all filters up to the next chain break and then condensing it to a single
 * filter. The following rules are used for this:
 * 1. Only the first user found is used considered.
 * 2. Only the first neuron found is considered.
 */
NeuronNavigator.Node.prototype.get_filter_set = function()
{
  var filters = this.collect_filters();
  var final_filter = filters.reduce(function(o, f, i) {
    // Use the first user filter available
    if (!o.user_id && f.user_id) {
      o.user_id = f.user_id;
    }
    // Use the first neuron available
    if (!o.neuron_id && f.neuron_id) {
      o.neuron_id = f.neuron_id;
    }

    if (f.annotation_id) {
      o.annotations.push(f.annotation_id);
    }

    if (f.is_meta) {
      o.is_meta = true;
      if (f.annotates) {
        o.annotates = true;
      }
    }

    return o;

  }, {is_meta: false,
      annotates: false,
      annotations: []}
  );

  return final_filter;
};

NeuronNavigator.Node.prototype.breaks_filter_chain = function()
{
  return false;
};

NeuronNavigator.Node.prototype.add_content = function(container)
{
  return undefined;
};

/**
 * A convenience helper for creating a table header. It procues text header
 * nodes if strings are provided and will add objects directly to the TH tag
 * otherwise.
 */
NeuronNavigator.Node.prototype.create_header_row = function(columns)
{
  var tr = columns.reduce(function(tr, col) {
    var th = document.createElement('th');
    if (typeof col == 'string') {
      th.appendChild(document.createTextNode(col));
    } else {
      th.appendChild(col);
    }
    tr.appendChild(th);
    return tr;
  }, document.createElement('tr'));

  return tr;
};

/**
 * Adds a datatable like menu to the container passed.
 */
NeuronNavigator.Node.prototype.add_menu_table = function(entries, container)
{
  var toolbar_classes = 'fg-toolbar ui-toolbar ui-widget-header' +
      ' ui-helper-clearfix'

  // Create top tool bar
  var top_toolbar = document.createElement('div');
  top_toolbar.setAttribute('class', toolbar_classes +
      ' ui-corner-tl ui-corner-tr' );
  top_toolbar.appendChild(document.createTextNode("Please select..."));

  // Create table body
  var table_body = document.createElement('tbody');
  var odd=true;
  var rows = entries.map(function(e) {
    var td = document.createElement('td');
    td.appendChild(document.createTextNode(e));
    var tr = document.createElement('tr');
    tr.appendChild(td);
    tr.setAttribute('class', odd ? "odd" : "even");
    table_body.appendChild(tr);

    odd = !odd;
    return tr;
  });

  // Create table itself
  var table = document.createElement('table');
  table.setAttribute('class', 'display');
  table.setAttribute('cellpadding', 0);
  table.setAttribute('cellspacing', 0);
  table.setAttribute('border', 0);
  table.appendChild(table_body);

  // Create bottom tool bar with 1em height
  var bottom_toolbar = document.createElement('div');
  bottom_toolbar.setAttribute('class', toolbar_classes +
      'ui-corner-bl ui-corner-br');
  bottom_toolbar.style.height = '1em';

  // Add single elements to container
  container.appendChild(top_toolbar);
  container.appendChild(table);
  container.appendChild(bottom_toolbar);

  return rows;
};

NeuronNavigator.Node.prototype.add_annotation_list_table = function($container,
    table_id, filters, display_annotator, unlink_handler, callback)
{
  var content = document.createElement('div');
  content.setAttribute('id', 'navigator_annotationlist_content' +
      this.navigator.widgetID);

  // Prepare column definition, depending on whether there is a removal handler
  // and if the annotator should be displayed.
  var columns = ['Annotation', 'Last used', '# used'];
  var column_params = [
      { // Annotation name
        "bSearchable": true,
        "bSortable": true
      },
      { // Last used date
        "bSearchable": false,
        "bSortable": true
      },
      { // Usage
        "bSearchable": false,
        "bSortable": true
      },
    ];
  if (display_annotator) {
      columns.push('Annotator');
      column_params.push(
        { // Annotator username
          "bSearchable": true,
          "bSortable": true,
          "mRender": function(data, type, full) {
            return full[3] in User.all() ? User.all()[full[3]].login : "unknown";
          }
        });
  }
  if (unlink_handler) {
    var self = this;
    columns.push('Action');
    column_params.push(
      {
        "sWidth": '5em',
        "sClass": 'selector_column center',
        "bSearchable": false,
        "bSortable": false,
        "mRender": function (data, type, full) {
          var a_class = 'navigator_annotation_unlink_caller' +
              self.navigator.widgetID;
          return '<a href="#" class="' + a_class + '" annotation_id="' +
              full[4] + '">de-annotate</>';
      }
    });
  }

  // Create annotation table
  var table_header = document.createElement('thead');
  table_header.appendChild(this.create_header_row(columns));
  var table_footer = document.createElement('tfoot');
  table_footer.appendChild(this.create_header_row(columns));
  var table = document.createElement('table');
  table.setAttribute('id', table_id);
  table.setAttribute('class', 'display');
  table.setAttribute('cellpadding', 0);
  table.setAttribute('cellspacing', 0);
  table.setAttribute('border', 0);
  table.appendChild(table_header);
  table.appendChild(table_footer);

  content.appendChild(table);

  // Add table to DOM
  $container.append(content);

  // Add a general handler for this table to catch all clicks on the
  // unlink links.
  if (unlink_handler) {
    $(table).on('click', ' a.navigator_annotation_unlink_caller' +
        this.navigator.widgetID, function () {
            var ann_id = $(this).attr('annotation_id');
            unlink_handler(ann_id);
        });
  }

  // Fill annotation table
  var datatable = $(table).dataTable({
    // http://www.datatables.net/usage/options
    "bDestroy": true,
    "sDom": '<"H"lrf>t<"F"ip>',
    "bProcessing": true,
    "bServerSide": true,
    "bAutoWidth": false,
    "iDisplayLength": this.possibleLengths[0],
    "sAjaxSource": django_url + project.id + '/annotations/table-list',
    "fnServerData": function (sSource, aoData, fnCallback) {
        if (filters.is_meta) {
          if (filters.annotates) {
            // Annotates filter -- we are requesting annotations that are
            // annotating entities
            filters.annotations.forEach(function(annotation_id, i) {
              aoData.push({
                  'name': 'annotates[' + i + ']',
                  'value': annotation_id
              });
            });
          } else {
            // Annotated with filter -- we are requesting annotations that are
            // annotated with specific annotations
            filters.annotations.forEach(function(annotation_id, i) {
              aoData.push({
                  'name': 'annotations[' + i + ']',
                  'value': annotation_id
              });
            });
          }
        } else {
          // Multiple parallel co-annotations -- all listed annotations appear only
          // together with these annotations
          filters.annotations.forEach(function(annotation_id, i) {
            aoData.push({
                'name': 'parallel_annotations[' + i + ']',
                'value': annotation_id
            });
            // Additionally, increase the number of annotations page, because
            // co-annotations will be filtered out in the response handler.
            aoData.forEach(function(e) {
              if (e.name == 'iDisplayLength') {
                e.value += filters.annotations.length;
              }
            });
          });
        }

        // User filter -- we are requesting annotations that are used by a
        // particular user.
        if (filters.user_id) {
          aoData.push({
              'name': 'user_id',
              'value': filters.user_id
          });
        }
        // Neuron filter -- we are requesting annotations that are used for
        // a particular neuron.
        if (filters.neuron_id) {
          aoData.push({
              'name': 'neuron_id',
              'value': filters.neuron_id
          });
        }
        $.ajax({
            "dataType": 'json',
            "cache": false,
            "type": "POST",
            "url": sSource,
            "data": aoData,
            "success": function(result) {
                // Filter all previously chosen co-annotations to not display
                // them in the list for new co-annotations.
                if (!filters.is_meta) {
                  var new_aaData = result.aaData.filter(function(e) {
                    return !filters.annotations.some(function(a_id) {
                      return e[4] === a_id;
                    });
                  });
                  var n_entries = result.iTotalRecords -
                      filters.annotations.length;
                  result.iTotalDisplayRecords = n_entries;
                  result.iTotalRecords = n_entries;
                  result.aaData = new_aaData;
                }
                // Regular datatable processing and callback
                fnCallback(result);
                if (callback) {
                  callback(result);
                }
            }
        });
    },
    "aLengthMenu": [
        this.possibleLengths,
        this.possibleLengthsLabels
    ],
    "oLanguage": {
      "sSearch": "Search annotations (regex):"
    },
    "bJQueryUI": true,
    "aaSorting": [[ 0, "asc" ]],
    "aoColumns": column_params
  });

  return datatable;
};

NeuronNavigator.Node.prototype.add_user_list_table = function($container,
    table_id, filters)
{
  var content = document.createElement('div');
  content.setAttribute('id', 'navigator_users_content' +
      this.navigator.widgetID);

  // Create user table
  var columns = ['Login', 'First Name', 'Last Name', 'ID'];
  var table_header = document.createElement('thead');
  table_header.appendChild(this.create_header_row(columns));
  var table_footer = document.createElement('tfoot');
  table_footer.appendChild(this.create_header_row(columns));
  var table = document.createElement('table');
  table.setAttribute('id', table_id);
  table.setAttribute('class', 'display');
  table.setAttribute('cellpadding', 0);
  table.setAttribute('cellspacing', 0);
  table.setAttribute('border', 0);
  table.appendChild(table_header);
  table.appendChild(table_footer);

  content.appendChild(table);

  // Add table to DOM
  $container.append(content);

  // Fill user table
  var datatable = $(table).dataTable({
    "bDestroy": true,
    "sDom": '<"H"lr>t<"F"ip>',
    "bProcessing": true,
    "bServerSide": true,
    "bAutoWidth": false,
    "iDisplayLength": this.possibleLengths[0],
    "sAjaxSource": django_url + 'user-table-list',
    "fnServerData": function (sSource, aoData, fnCallback) {
        // Annotation filter -- we are requesting users that have
        // used a certain annotation
        if (filters.annotations) {
          filters.annotations.forEach(function(annotation, i) {
            aoData.push({
                'name': 'annotations[' + i + ']',
                'value': annotation
            });
          });
        }
        // Neuron filter -- only users who annotated this neuron
        // are shown.
        if (filters.neuron_id) {
          aoData.push({
              'name': 'neuron_id',
              'value': filters.neuron_id
          });
        }
        $.ajax({
            "dataType": 'json',
            "cache": false,
            "type": "POST",
            "url": sSource,
            "data": aoData,
            "success": fnCallback
        });
    },
    "aLengthMenu": [
        this.possibleLengths,
        this.possibleLengthsLabels
    ],
    "bJQueryUI": true,
    "aaSorting": [[ 0, "asc" ]],
    "aoColumns": [
      {
        "sClass": "center",
        "bSearchable": true,
        "bSortable": true
      },
      {
        "sClass": "center",
        "bSearchable": true,
        "bSortable": true
      },
      {
        "sClass": "center",
        "bSearchable": true,
        "bSortable": true
      },
      {
        "sClass": "center",
        "bSearchable": true,
        "bSortable": true
      },
    ]
  });

  return datatable;
};

NeuronNavigator.Node.prototype.add_neuron_list_table = function($container,
    table_id, filters, callback)
{
  // Create annotate button
  var annotate_button = document.createElement('input');
  annotate_button.setAttribute('type', 'button');
  annotate_button.setAttribute('value', 'Annotate');
  $container.append(annotate_button);

  var content = document.createElement('div');
  content.setAttribute('id', 'navigator_neuronlist_content' +
      this.navigator.widgetID);

  // Create neuron table
  var selected_cb1 = document.createElement('input');
  selected_cb1.setAttribute('type', 'checkbox');
  var columns1 = [selected_cb1, 'Name'];
  var table_header = document.createElement('thead');
  table_header.appendChild(this.create_header_row(columns1));
  var selected_cb2 = document.createElement('input');
  selected_cb2.setAttribute('type', 'checkbox');
  var columns2 = [selected_cb2, 'Name'];
  var table_footer = document.createElement('tfoot');
  table_footer.appendChild(this.create_header_row(columns2));
  var table = document.createElement('table');
  table.setAttribute('id', table_id);
  table.setAttribute('class', 'display');
  table.setAttribute('cellpadding', 0);
  table.setAttribute('cellspacing', 0);
  table.setAttribute('border', 0);
  table.appendChild(table_header);
  table.appendChild(table_footer);

  content.appendChild(table);

  // Add table to DOM
  $container.append(content);

  // Fill neuron table
  var datatable = $(table).dataTable({
    // http://www.datatables.net/usage/options
    "bDestroy": true,
    "sDom": '<"H"lrf>t<"F"ip>',
    "bProcessing": true,
    "bServerSide": true,
    "bAutoWidth": false,
    "iDisplayLength": this.possibleLengths[0],
    "sAjaxSource": django_url + project.id + '/neuron/table/query-by-annotations',
    "fnServerData": function (sSource, aoData, fnCallback) {
        // Annotation filter
        if (filters.annotations) {
          filters.annotations.forEach(function(annotation_id, i) {
            aoData.push({
                'name': 'neuron_query_by_annotation[' + i + ']',
                'value': annotation_id
            });
          });
        }
        // User filter -- only show neurons that have been annotated by the
        // user in question
        if (filters.user_id) {
          aoData.push({
              'name': 'neuron_query_by_annotator',
              'value': filters.user_id
          });
        }
        $.ajax({
            "dataType": 'json',
            "cache": false,
            "type": "POST",
            "url": sSource,
            "data": aoData,
            "success": function(result) {
                fnCallback(result);
                if (callback) {
                  callback(result);
                }
            }
        });
    },
    "aLengthMenu": [
        this.possibleLengths,
        this.possibleLengthsLabels
    ],
    "oLanguage": {
      "sSearch": "Search neuron names (regex):"
    },
    "bJQueryUI": true,
    "aaSorting": [[ 1, "asc" ]],
    "aoColumns": [
      {
        "sWidth": '5em',
        "sClass": 'selector_column center',
        "bSearchable": false,
        "bSortable": false,
        "mRender": function (data, type, full) {
          var cb_id = 'navigator_neuron_' + full[3] + '_selection' +
              self.navigator.widgetID;
          return '<input type="checkbox" id="' + cb_id +
              '" name="someCheckbox" neuron_id="' + full[3] + '" />';
      },
      },
      {
        "bSearchable": true,
        "bSortable": true,
        "mData": 0,
        "aDataSort": [ 0 ],
      },
    ]
  });

  // Wire up handlers

  // Make self accessible in callbacks more easily
  var self = this;

  $(annotate_button).click(function() {
    var cb_selector = '#navigator_neuronlist_table' +
        self.navigator.widgetID + ' tbody td.selector_column input';
    var selected_neurons = $(cb_selector).toArray().reduce(function(ret, cb) {
      if ($(cb).prop('checked')) {
        ret.push($(cb).attr('neuron_id'));
      }
      return ret;
    }, []);

    if (selected_neurons.length > 0) {
      NeuronAnnotations.prototype.annotate_entities(selected_neurons);
    } else {
      alert("Please select at least one neuron to annotate first!");
    }
  });

  // Add click handler for the select column's header to select/unselect
  // all check boxes at once.
  $('#' + table_id).on('click', 'thead th input,tfoot th input', function (e) {
    var checkboxes = $('#' + table_id).find('tbody td.selector_column input');
    checkboxes.prop("checked", $(this).prop("checked"));
    // Toggle second checkbox
    var $cb1 = $('#' + table_id).find('thead th input');
    var $cb2 = $('#' + table_id).find('tfoot th input');
    if ($cb1.length > 0 && $cb2.length > 0) {
      if (this === $cb1[0]) {
        $cb2.prop('checked', !$cb2.prop('checked'));
      } else if (this === $cb2[0]) {
        $cb1.prop('checked', !$cb1.prop('checked'));
      }
    }
  });

  // Add a change handler for the check boxes in each row
  $('#' + table_id).on('change', 'tbody td.selector_column input', (function() {
    // Update sync link
    this.navigator.updateLink(this.navigator.getSelectedSkeletonModels());
  }).bind(this));

  // Add double click handler for table cells containing a select check box
  $('#' + table_id).on('click', 'tbody td.selector_column', function (event) {
      // Make sure the event doesn't bubble up, because otherwise it would reach
      // the click handler of the tr element.
      event.stopPropagation();
      // Toggle check box if the event target isn't the checkbox itself and was
      // therefore triggered already.
      if (!$(event.target).is('input')) {
        var checkbox = $(this).find('input');
        checkbox.prop("checked", !checkbox.prop("checked"));
      }
  });

  // If a neuron is selected a neuron filter node is created
  $('#' + table_id).on('dblclick', 'tbody tr', function () {
      var aData = datatable.fnGetData(this);
      var n = {
        'name': aData[0],
        'skeleton_ids': aData[2],
        'id': aData[3],
      };
      var node = new NeuronNavigator.NeuronNode(n);
      node.link(self.navigator, self);
      self.navigator.select_node(node);
  });

  return datatable;
};


/**
 * This mixin introduces fields and functions to have and work with a list
 * neurons. It supports the interface to retrieve and highlight selected
 * skeletons.
 */
NeuronNavigator.NeuronListMixin = function()
{
  this.listed_neurons = [];
}

/**
 * Returns the IDs of the skeletons modeling the currently selected neurons.
 */
NeuronNavigator.NeuronListMixin.prototype.getSelectedSkeletons = function() {
  return this.get_entities(true).reduce(function(o, e) {
    return o.concat(e.skeleton_ids);
  }, []);
};

/**
 * Tests if one the current list of neurons has a particular skeleton model.
 */
NeuronNavigator.NeuronListMixin.prototype.hasSkeleton = function(skeleton_id) {
  return this.listed_neurons.some(function(n) {
    return n.skeleton_ids.indexOf(skeleton_id) != -1;
  });
};

/**
 * If a neuron in the current list is modeled by this particular skeleton ID, it
 * will be highlighted.
 */
NeuronNavigator.NeuronListMixin.prototype.highlight = function(skeleton_id)
{
  var $cells = $('#navigator_neuronlist_table' + this.navigator.widgetID +
      ' tbody td');
  // Remove any highlighting
  $cells.css('background-color', '');
  // Highlight corresponding row if present
  this.listed_neurons.forEach(function(n) {
    if (n.skeleton_ids.indexOf(skeleton_id) != -1) {
      var $row_cells = $cells.find('input[neuron_id=' + n.id + ']').
          parent().parent().find('td');
      $row_cells.css('background-color',
          SelectionTable.prototype.highlighting_color);
    }
  });
};

/**
 * Retruns a skeleton model dictionary.
 */
NeuronNavigator.NeuronListMixin.prototype.getSelectedSkeletonModels = function() {
  return this.get_entities(true).reduce((function(o, n) {
    n.skeleton_ids.forEach(function(skid) {
      o[skid] = new SelectionTable.prototype.SkeletonModel(
          skid, n.name, new THREE.Color().setRGB(1, 1, 0));
    });
    return o;
  }).bind(this), {});
};


/**
 * If passed true, this function returns a list of selected entities in the
 * neuron list. Otherweise, a list of unselected entities is returned.
 */
NeuronNavigator.NeuronListMixin.prototype.get_entities = function(checked)
{
  if (!this.listed_neurons) return [];

  var checked_neuron_IDs = $('#navigator_neuronlist_table' + this.navigator.widgetID + ' tbody input')
    .filter(function(i, cb) { return cb.checked; })
    .toArray()
    .reduce(function(o, cb) { o[cb.getAttribute('neuron_id')] = true; return o; }, {});

  return this.listed_neurons.filter(function(neuron) {
    return neuron.id in checked_neuron_IDs;
  });
};

/**
 * Generate a function that will use the list of neurons as its 'this'.
 */
NeuronNavigator.NeuronListMixin.prototype.post_process_fn = function(listed_neurons) {
  // Callback for post-process data received from server
  return (function(result) {
      // Reset the neuron list
      this.length = 0;
      // Store the new neurons in the list
      result.aaData.forEach(function(e) {
          this.push({
            name: e[0],
            annotations: e[1],
            skeleton_ids: e[2],
            id: e[3]
          });
      }, this);
  }).bind(listed_neurons);
};

NeuronNavigator.NeuronListMixin.prototype.add_neuronlist_content =
    function(container, filters)
{
  var table_id = 'navigator_neuronlist_table' + this.navigator.widgetID;
  var datatable = this.add_neuron_list_table(container, table_id, filters,
      this.post_process_fn(this.listed_neurons));
}


/**
 * The annotation list node of the navigator provides a list of all available
 * annotations. If double clicked on a listed annotations, it adds a new
 * annotation filter node.
 */
NeuronNavigator.AnnotationListNode = function(creates_co_annotations)
{
  if (creates_co_annotations) {
    this.name = "Co-Annotations";
    this.creates_co_annotations = true;
  } else {
    this.name = "Annotations";
    this.creates_co_annotations = false;
  }
};

NeuronNavigator.AnnotationListNode.prototype = {};
$.extend(NeuronNavigator.AnnotationListNode.prototype,
    new NeuronNavigator.Node(""));

NeuronNavigator.AnnotationListNode.prototype.become_co_annotation_list =
    function()
{
};

NeuronNavigator.AnnotationListNode.prototype.create_annotation_filter =
    function(annotation, annotation_id)
{
  return new NeuronNavigator.AnnotationFilterNode(annotation, annotation_id,
      this.creates_co_annotations, false);
};

NeuronNavigator.AnnotationListNode.prototype.add_content = function(container,
    filters)
{
  // If this node should display co-annotations, it needs to remove the last
  // annotation found in the filters and use it as a parallel annotation.
  var table_id = 'navigator_annotationlist_table' + this.navigator.widgetID;

  // Add annotation data table based on filters above
  var datatable = this.add_annotation_list_table(container, table_id, filters,
      false, null, null);

  // Make self accessible in callbacks more easily
  var self = this;

  // If an annotation is selected an annotation filter node is created and the
  // event is removed. If the annotation list node should create co-annotations,
  // a co-annotaion-filter is created.
  $('#' + table_id).on('dblclick', ' tbody tr', function () {
      var aData = datatable.fnGetData(this);
      var annotation = aData[0];
      var annotation_id = aData[4];
      var annotations_node = self.create_annotation_filter(annotation, annotation_id);
      annotations_node.link(self.navigator, self);
      self.navigator.select_node(annotations_node);
  });
};

/**
 * The meta annotation list node of the navigator provides a list of all
 * available annotations that are either annotated with the given class or that
 * annotats it. If double clicked on a listed annotations, it adds a new
 * annotation filter node.
 */
NeuronNavigator.MetaAnnotationListNode = function(annotates)
{
  this.is_meta = true;
  this.annotates = annotates;
  this.name = annotates ? "Annotates" : "Annotated with";
};

NeuronNavigator.MetaAnnotationListNode.prototype = {};
$.extend(NeuronNavigator.MetaAnnotationListNode.prototype,
    new NeuronNavigator.AnnotationListNode(false));

NeuronNavigator.MetaAnnotationListNode.prototype.create_annotation_filter =
    function(annotation, annotation_id)
{
  return new NeuronNavigator.AnnotationFilterNode(annotation, annotation_id, false,
      this.is_meta_annotation);
};


/**
 * The user list node of the navigator provides a list of all existing users.
 * It will add a user filter node if double clicked on one of them.
 */
NeuronNavigator.UserListNode = function() {};

NeuronNavigator.UserListNode.prototype = {};
$.extend(NeuronNavigator.UserListNode.prototype,
    new NeuronNavigator.Node("Users"));

NeuronNavigator.UserListNode.prototype.add_content = function(container,
    filters)
{
  var table_id = 'navigator_user_table' + this.navigator.widgetID;
  var datatable = this.add_user_list_table(container, table_id, filters);

  // Make self accessible in callbacks more easily
  var self = this;
  // If a user is selected a user filter node is created and the event is
  // removed.
  $('#' + table_id).on('dblclick', ' tbody tr', function () {
      var aData = datatable.fnGetData(this);
      var user = {
        'login': aData[0],
        'first_name': aData[1],
        'last_name': aData[2],
        'id': aData[3],
      }
      var filter_node = new NeuronNavigator.UserFilterNode(user);
      filter_node.link(self.navigator, self);
      self.navigator.select_node(filter_node);
  });
};


/**
 * The neuron list node of the navigator lists all neurons. It is the simplest
 * user of the neuron list mixin.
 */
NeuronNavigator.NeuronListNode = function() {};

NeuronNavigator.NeuronListNode.prototype = {};
$.extend(NeuronNavigator.NeuronListNode.prototype,
    new NeuronNavigator.Node("Neurons"));
$.extend(NeuronNavigator.NeuronListNode.prototype,
    new NeuronNavigator.NeuronListMixin());

NeuronNavigator.NeuronListNode.prototype.add_content = function(container,
    filters)
{
  this.add_neuronlist_content(container, filters);
};


/**
 * The annotation filter node of the navigator filters output based on the
 * existence of an annotations. The content it creates lists user, neuron,
 * annotation and co-annotation links.
 */
NeuronNavigator.AnnotationFilterNode = function(annotation, annotation_id,
    is_coannotation, is_meta_annotation)
{
  this.annotation = annotation;
  this.annotation_id = annotation_id;
  this.is_coannotation = is_coannotation;
  this.is_meta_annotation = is_meta_annotation;
  this.name = annotation;
};

NeuronNavigator.AnnotationFilterNode.prototype = {};
$.extend(NeuronNavigator.AnnotationFilterNode.prototype,
    new NeuronNavigator.Node("Empty Annotation Filter"));
$.extend(NeuronNavigator.AnnotationFilterNode.prototype,
    new NeuronNavigator.NeuronListMixin());

NeuronNavigator.AnnotationFilterNode.prototype.breaks_filter_chain = function()
{
  return !this.is_coannotation;
};

NeuronNavigator.AnnotationFilterNode.prototype.add_content = function(container,
    filters)
{
  var content = document.createElement('div');

  // Add 'Annotate annotation' button
  var annotate_button = document.createElement('input');
  annotate_button.setAttribute('type', 'button');
  annotate_button.setAttribute('value', 'Annotate annotation');
  container.append(annotate_button);

  // Create menu and add it to container
  var menu_entries = ['Annotates', 'Annotated with', 'Co-Annotations', 'Users',
      'Neurons'];
  var table_rows = this.add_menu_table(menu_entries, content);

  // Add container to DOM
  container.append(content);

  // Handle annotation of annotations
  $(annotate_button).click((function() {
    NeuronAnnotations.prototype.annotate_entities([this.annotation_id],
        (function() { this.navigator.select_node(this); }).bind(this));
  }).bind(this));

  // Append double click handler
  $(table_rows[0]).dblclick($.proxy(function() {
      // Show annotation list for annotated annotations
      var annotations_node = new NeuronNavigator.MetaAnnotationListNode(true);
      annotations_node.link(this.navigator, this);
      this.navigator.select_node(annotations_node);
  }, this));
  $(table_rows[1]).dblclick($.proxy(function() {
      // Show annotation list for meta annotations
      var annotations_node = new NeuronNavigator.MetaAnnotationListNode(false);
      annotations_node.link(this.navigator, this);
      this.navigator.select_node(annotations_node);
  }, this));
  $(table_rows[2]).dblclick($.proxy(function() {
      // Show co-annotation list
      var node = new NeuronNavigator.AnnotationListNode(true);
      node.link(this.navigator, this);
      this.navigator.select_node(node);
  }, this));
  $(table_rows[3]).dblclick($.proxy(function() {
      // Show user list
      var users_node = new NeuronNavigator.UserListNode();
      users_node.link(this.navigator, this);
      this.navigator.select_node(users_node);
  }, this));
  $(table_rows[4]).dblclick($.proxy(function() {
      // Show neuron list
      var node = new NeuronNavigator.NeuronListNode();
      node.link(this.navigator, this);
      this.navigator.select_node(node);
  }, this));

  // Add a list of neurons matching the current filter set including the current
  // annotation filter node.
  var neuron_title = document.createElement('h4');
  neuron_title.appendChild(document.createTextNode('Neurons'));
  container.append(neuron_title);

  // Add content from neuron list node. As a currently needed hack, a copy
  // of the current node has to be added.
  this.add_neuronlist_content(container, filters);
};


/**
 * The user filter node of the navigator filters output based on the
 * ownership by a particular user. The content it creates lists user, neuron,
 * annotation and co-annotation links.
 */
NeuronNavigator.UserFilterNode = function(included_user)
{
  this.user_id = included_user.id;
  this.name = included_user.login;
};

NeuronNavigator.UserFilterNode.prototype = {};
$.extend(NeuronNavigator.UserFilterNode.prototype,
    new NeuronNavigator.Node("Empty User Filter"));

NeuronNavigator.UserFilterNode.prototype.breaks_filter_chain = function()
{
  return true;
};

NeuronNavigator.UserFilterNode.prototype.add_content = function(container,
    filters)
{
  var content = document.createElement('div');

  // Create menu and add it to container
  var menu_entries = ['Annotations', 'Neurons'];
  var table_rows = this.add_menu_table(menu_entries, content);

  // Add container to DOM
  container.append(content);

  // Append double click handler
  $(table_rows[0]).dblclick($.proxy(function() {
      // Show annotation list
      var annotations_node = new NeuronNavigator.AnnotationListNode();
      annotations_node.link(this.navigator, this);
      this.navigator.select_node(annotations_node);
  }, this));
  $(table_rows[1]).dblclick($.proxy(function() {
      // Show neuron list
      var node = new NeuronNavigator.NeuronListNode();
      node.link(this.navigator, this);
      this.navigator.select_node(node);
  }, this));
};


/**
 * A neuron node displays information about a particular node. It shows all the
 * skeletons that are model for a neuron as well as all its annotations and the
 * user that has locked it.
 */
NeuronNavigator.NeuronNode = function(neuron)
{
  this.neuron_id = neuron.id;
  this.neuron_name = neuron.name;
  this.name = neuron.name;
  this.skeleton_ids = neuron.skeleton_ids;
};

NeuronNavigator.NeuronNode.prototype = {};
$.extend(NeuronNavigator.NeuronNode.prototype,
    new NeuronNavigator.Node("Neuron node"));

NeuronNavigator.NeuronNode.prototype.breaks_filter_chain = function()
{
  return true;
};

NeuronNavigator.NeuronNode.prototype.create_ann_post_process_fn = function(
    node, $container)
{
  // Callback for post-process data received from server when creating the
  // annotation table.
  return function(result) {
      // Check if the neuron is locked and if so who did it
      var locked = result.aaData.filter(function(e) {
          // 0: name, 1: last used. 2: used, 3: annotator, 4: id
          return e[0] === 'locked';
      });
      var id = 'nl_locked_user_info' + node.navigator.widgetID;
      // Remove old info, if available
      $('#' + id, $container).remove()
      // Add new info
      var annotation_title = document.createElement('h4');
      annotation_title.setAttribute('id', id);
      $container.append(annotation_title);
      if (locked.length > 0) {
        var add_user_info = function(locked_user) {
          annotation_title.appendChild(document.createTextNode(
              'User who locked this neuron: '));
          var a = document.createElement('a');
          a.appendChild(document.createTextNode(locked_user.login));
          annotation_title.appendChild(a);
          // If one clicks the user who locked the neuron, a new user filter
          // node is created.
          $(a).on('click', function () {
                var user = {
                  'login': locked_user.login,
                  'id': locked_user.id,
                }
                var filter_node = new NeuronNavigator.UserFilterNode(user);
                filter_node.link(node.navigator, node);
                node.navigator.select_node(filter_node);
          });
        };

        // If the user isn't available client-side, schedule an update of the
        // user information the client-side.
        var locked_user_id = locked[0][3];
        User.auto_update_call(locked_user_id, add_user_info);
      } else {
        annotation_title.appendChild(document.createTextNode(
            'No one locked this neuron'));
      }
  };
};

NeuronNavigator.NeuronNode.prototype.add_content = function(container, filters)
{
  // Make self accessible in callbacks more easily
  var self = this;

  container.addClass('multi_table_node');

  // Create refresh button
  var refresh_button = document.createElement('input');
  refresh_button.setAttribute('type', 'button');
  refresh_button.setAttribute('value', 'Refresh');
  container.append(refresh_button);

  // When clicked, the refresh button will reload this node
  $(refresh_button).click((function() {
    this.navigator.select_node(this);
  }).bind(this));

  // Create annotate button
  var annotate_button = document.createElement('input');
  annotate_button.setAttribute('type', 'button');
  annotate_button.setAttribute('value', 'Annotate');
  container.append(annotate_button);

  // When clicked, the annotate button should prompt for a new annotation and
  // reload the node
  $(annotate_button).click((function() {
    NeuronAnnotations.prototype.annotate_entities([this.neuron_id],
        (function() { this.navigator.select_node(this); }).bind(this));
  }).bind(this));

  var rename_button = document.createElement('input');
  rename_button.setAttribute('type', 'button');
  rename_button.setAttribute('value', 'Rename');
  container.append(rename_button);

  rename_button.onclick = (function() {
    var new_name = prompt("Rename", this.neuron_name);
    if (!new_name) return;
    requestQueue.register(django_url + project.id + '/object-tree/instance-operation',
      'POST',
      {operation: "rename_node",
       id: this.neuron_id,
       title: new_name,
       classname: "neuron",
       pid: project.id},
      (function(status, text) {
        if (200 !== status) return;
        var json = $.parseJSON(text);
        if (json.error) return new ErrorDialog(json.error, json.detail).show();
        // Update UI
        if (this.skeleton_ids.some(function(skid) { return skid === SkeletonAnnotations.getActiveSkeletonId();})) {
          SkeletonAnnotations.setNeuronNameInTopbar(project.focusedStack.id, new_name, SkeletonAnnotations.getActiveSkeletonId());
        }
        $('div.nodeneuronname', container).html('Name: ' + new_name);
        this.neuron_name = new_name;
      }).bind(this));
  }).bind(this);

  var activate_button = document.createElement('input');
  activate_button.setAttribute('type', 'button');
  activate_button.setAttribute('value', 'Go to nearest node');
  container.append(activate_button);

  activate_button.onclick = (function() {
    TracingTool.goToNearestInNeuronOrSkeleton('neuron', this.neuron_id);
  }).bind(this);

  var root_button = document.createElement('input');
  root_button.setAttribute('type', 'button');
  root_button.setAttribute('value', 'Go to root node');
  container.append(root_button);

  root_button.onclick = (function() {
    requestQueue.register(django_url + project.id + '/skeleton/' + this.skeleton_ids[0] + '/get-root', "POST", { pid: project.id }, function (status, text) {
      if (200 !== status) return;
      var json = $.parseJSON(text);
      if (json.error) return new ErrorDialog(json.error, json.detail).show();
      SkeletonAnnotations.staticMoveTo(json.z, json.y, json.x, function() {
        SkeletonAnnotations.staticSelectNode(json.root_id);
      });
    });
  }).bind(this);

  var delete_button = document.createElement('input');
  delete_button.setAttribute('type', 'button');
  delete_button.setAttribute('value', 'Delete');
  container.append(delete_button);

  delete_button.onclick = (function() {
    if (confirm("Are you sure that neuron '" + this.neuron_name +
        "' and its skeleton should get deleted?")) {
      requestQueue.register(django_url + project.id + '/neuron/' +
          this.neuron_id + '/delete', 'GET', {}, (function(status, text) {
            if (200 !== status) {
              return new ErrorDialog("Unexpected status: " + 400).show();
            }
            var json = $.parseJSON(text);
            if (json.error) {
              return new ErrorDialog(json.error, json.detail).show();
            }
            growlAlert("Delete successful", "The neuron with ID " +
                this.neuron_id + " has been succesfully deleted.") ;
            // Expect a parent node
            this.navigator.select_node(this.parent_node);
            // Refresh tracing layer to reflect the removed neuron
            var tool = project.getTool();
            if (tool) {
              if (tool.deselectActiveNode) tool.deselectActiveNode();
              if (tool.updateLayer) tool.updateLayer();
            }
          }).bind(this));
    }
  }).bind(this);

  /* Skeletons: Request compact JSON data */
  var content = document.createElement('div');
  content.setAttribute('id', 'navigator_skeletonlist_content' +
      this.navigator.widgetID);

  // Create skeleton table
  var columns = ['Skeleton ID', 'N nodes', 'N branch nodes', 'N end nodes',
      'N open end nodes'];
  var table_header = document.createElement('thead');
  table_header.appendChild(this.create_header_row(columns));
  var skeleton_table_id = 'navigator_skeletonlist_table' + this.navigator.widgetID;
  var table = document.createElement('table');
  table.setAttribute('id', skeleton_table_id);
  table.setAttribute('class', 'display');
  table.setAttribute('cellpadding', 0);
  table.setAttribute('cellspacing', 0);
  table.setAttribute('border', 0);
  table.appendChild(table_header);

  content.appendChild(table);

  // Add table to DOM
  container.append(content);

  var skeleton_datatable = $(table).dataTable({
    "bDestroy": true,
    "sDom": '<"H"<"nodeneuronname">r>t<"F">',
    // default: <"H"lfr>t<"F"ip>
    "bProcessing": true,
    "bAutoWidth": false,
    //"aLengthChange": false,
    "bJQueryUI": true,
    "bSort": false
  });

  // Add neuron name to caption
  $('div.nodeneuronname', container).html('Name: ' + this.neuron_name);

  // Manually request compact-json object for skeleton
  var loader_fn = function(skeleton_id) {
    requestQueue.register(django_url + project.id +
        '/skeleton/' + skeleton_id + '/compact-json', 'POST', {},
        function(status, text) {
          if (200 !== status) return;
          var json = $.parseJSON(text);
          if (json.error) {
            new ErrorDialog(json.error, json.detail).show();
            return;
          }
          var nodes = json[1],
              tags = json[2],
              arbor = new Arbor(),
              eb = arbor.findBranchAndEndNodes(),
              tagged = ['ends', 'uncertain end', 'not a branch', 'soma'].reduce(function(o, tag) {
                if (tag in tags) return tags[tag].reduce(function(o, nodeID) { o[nodeID] = true; return o; }, o);
                return o;
              }, []),
              n_tagged_ends = eb.ends.reduce(function(count, nodeID) { return nodeID in tagged ? count + 1 : count; }, 0);

          // TODO measure smoothed skeleton length: sum of distances from end to branh, branch to branch, and branch to root, with a moving three-point average, in nm

          // Put data into table
          skeleton_datatable.fnAddData([
            skeleton_id,
            nodes.length,
            eb.branching.length,
            eb.ends.length + 1, // count the soma
            eb.ends.length + 1 - n_tagged_ends,
          ]);
        });
  };

  var num_loaded = this.skeleton_ids.reduce(function(o, sk_id) {
    if (loader_fn(sk_id)) {
      return o + 1;
    } else {
      return o;
    }
  }, 0);

  // Add double click handler to skeleton to select it
  $('#' + skeleton_table_id).on('dblclick', ' tbody tr', function () {
      var aData = skeleton_datatable.fnGetData(this);
      var skeleton_id = aData[0];
      TracingTool.goToNearestInNeuronOrSkeleton( 'skeleton', skeleton_id );
  });


  /* Annotations */

  // Title
  var annotation_title = document.createElement('h4');
  annotation_title.appendChild(document.createTextNode('Annotations'));
  container.append(annotation_title);

  // Table filters and ID
  var annotation_table_id = 'navigator_annotationlist_table' +
      this.navigator.widgetID;

  // Add annotation data table based on filters above
  var annotation_datatable = this.add_annotation_list_table(container,
      annotation_table_id, filters, true, function(annotation_id) {
          // Unlink the annotation from the current neuron
          NeuronAnnotations.remove_annotation(self.neuron_id,
              annotation_id, function(message) {
                  // Display message returned by the server
                  growlAlert('Information', message);
                  // Refresh node
                  self.navigator.select_node(self);
              });
      }, this.create_ann_post_process_fn(this, container));

  // If a user is selected an annotation filter node is created and the event
  // is removed.
  $('#' + annotation_table_id).on('dblclick', ' tbody tr', function () {
      var aData = annotation_datatable.fnGetData(this);
      var a_name = aData[0];
      var a_id = aData[4];
      var annotations_node = new NeuronNavigator.AnnotationFilterNode(
          a_name, a_id);
      annotations_node.link(self.navigator, self);
      self.navigator.select_node(annotations_node);
  });
};

/**
 * Returns a list of skeleton IDs (usually one) modeling the current neuron.
 */
NeuronNavigator.NeuronNode.prototype.getSelectedSkeletons = function() {
  return this.skeleton_ids;
};

/**
 * Tests if the current neuron is modeled by a particular skeleton ID.
 */
NeuronNavigator.NeuronNode.prototype.hasSkeleton = function(skeleton_id) {
  return this.skeleton_ids.indexOf(skeleton_id) != -1;
};

/**
 * Highlights a row if it is representing the passed skeleton.
 */
NeuronNavigator.NeuronNode.prototype.highlight = function(skeleton_id)
{
  var $rows = $('#navigator_skeletonlist_table' +
      this.navigator.widgetID + ' tbody tr');
  // Remove any highlighting
  $rows.css('background-color', '');
  // Highlight corresponding row if present
  $rows.find('td:contains(' + skeleton_id + ')').parent().css(
      'background-color', SelectionTable.prototype.highlighting_color);
};

/**
 * Retruns a skeleton model dictionary.
 */
NeuronNavigator.NeuronNode.prototype.getSelectedSkeletonModels = function() {
  return this.skeleton_ids.reduce((function(o, skid) {
    o[skid] = new SelectionTable.prototype.SkeletonModel(
        skid, this.neuron_name, new THREE.Color().setRGB(1, 1, 0));
    return o;
  }).bind(this), {});
};


/**
 * A neuron node displays information about a particular node. It shows all the
 * skeletons that are model for a neuron as well as all its annotations and the
 * user that has locked it.
 */
NeuronNavigator.ActiveNeuronNode = function()
{
  this.current_skid = SkeletonAnnotations.getActiveSkeletonId();
  this.name = 'Active Neuron';
  this.sync_active_neuron = true;
};

NeuronNavigator.ActiveNeuronNode.prototype = {};
$.extend(NeuronNavigator.ActiveNeuronNode.prototype,
    new NeuronNavigator.NeuronNode({id: -1, name: '', skeleton_ids: []}));

NeuronNavigator.ActiveNeuronNode.prototype.add_content = function(container,
    filters)
{
  // Add checkbox to indicate if this node should update automatically if the
  // active neuron changes.
  var sync_checkbox = document.createElement('input');
  sync_checkbox.setAttribute('type', 'checkbox');
  if (this.sync_active_neuron) {
    sync_checkbox.setAttribute('checked', 'checked');
  }
  var sync_label = document.createElement('label');
  sync_label.appendChild(document.createTextNode('Sync active neuron'));
  sync_label.appendChild(sync_checkbox);
  sync_label.style.cssFloat = 'right';
  container.append(sync_label);
  $(sync_checkbox).change((function() {
    this.sync_active_neuron = $(sync_checkbox).is(':checked');
  }).bind(this));

  if (this.current_skid) {
    requestQueue.register(django_url + project.id + '/skeleton/' +
        this.current_skid + '/neuronname', 'POST', {}, (function(status, text) {
          if (200 !== status) {
            alert("Unexpected status code: " + status);
          } else {
            var json = $.parseJSON(text);
            if (json.error) {
              new ErrorDialog(json.error, json.detail).show();
            } else {
              this.skeleton_ids = [this.current_skid];
              this.neuron_id = json.neuronid;
              // Update the neuron name
              this.neuron_name = json.neuronname;
              // Call neuron node content creation. The neuron ID changed and we
              // want the content to reflect that. Therefore, the filters have
              // to be re-created.
              NeuronNavigator.NeuronNode.prototype.add_content.call(this,
                  container, this.get_filter_set());
            }
          }
    }).bind(this));
  } else {
    // Reset neuron data
    this.neuron_id = -1;
    this.skeleton_ids = [];
    // Print message
    var message = document.createElement('em');
    var text = 'There is currently no active node';
    message.appendChild(document.createTextNode(text));
    container.append(message);
  }
};

/**
 * Triggers a reload of this node with update skeleton ID data.
 */
NeuronNavigator.ActiveNeuronNode.prototype.highlight = function(skeleton_id)
{
  if (this.sync_active_neuron) {
    this.current_skid = skeleton_id;
    this.navigator.select_node(this);
  }
};


/**
 * The home node of the navigator. It links to annotation and users nodes.
 * Additionally, it allows to see the neuron of the active skeleton and displays
 * a list of all neurons available. Therefore, it extends the neuron list node.
 */
NeuronNavigator.HomeNode = function()
{
  // A home node acts as the root node and has therefore no parent.
  this.link(null);
};

NeuronNavigator.HomeNode.prototype = {};
$.extend(NeuronNavigator.HomeNode.prototype,
    new NeuronNavigator.Node("Home"));
$.extend(NeuronNavigator.HomeNode.prototype,
    new NeuronNavigator.NeuronListMixin());

NeuronNavigator.HomeNode.prototype.add_content = function(container, filters)
{
  var content = document.createElement('div');

  // Create menu and add it to container
  var menu_entries = ['Annotations', 'Users', 'Active Neuron'];
  var table_rows = this.add_menu_table(menu_entries, content);

  // Add container to DOM
  container.append(content);

  // Append double click handler
  $(table_rows[0]).dblclick($.proxy(function() {
      // Show annotation list
      var annotations_node = new NeuronNavigator.AnnotationListNode();
      annotations_node.link(this.navigator, this);
      this.navigator.select_node(annotations_node);
  }, this));
  $(table_rows[1]).dblclick($.proxy(function() {
      // Show user list
      var users_node = new NeuronNavigator.UserListNode();
      users_node.link(this.navigator, this);
      this.navigator.select_node(users_node);
  }, this));
  $(table_rows[2]).dblclick($.proxy(function() {
      // Show active neuron node
      var users_node = new NeuronNavigator.ActiveNeuronNode();
      users_node.link(this.navigator, this);
      this.navigator.select_node(users_node);
  }, this));

  // Add some space
  var neuron_title = document.createElement('h4');
  neuron_title.appendChild(document.createTextNode('All neurons'));
  container.append(neuron_title);

  // Add neuron list table
  this.add_neuronlist_content(container, filters);
};
