
var MessagesTable = new function()
{
	this.messagesTable = null;
	var self = this;
	

    var possibleLengths = [25, 100, 500, 2000, -1];
    var possibleLengthsLabels = possibleLengths.map(
        function (n) { return (n === -1) ? "All" : n.toString(); });	
	
	this.init = function() {
		var tableid = '#msgtable';
		self.messagesTable = $(tableid).dataTable(
				{
	                // http://www.datatables.net/usage/options
	                "bDestroy": true,
	                "sDom": '<"H"lr>t<"F"ip>',
	                // default: <"H"lfr>t<"F"ip>
	                "bProcessing": true,
	                "bServerSide": true,
	                "bAutoWidth": false,
	                "iDisplayLength": possibleLengths[0],
	                "sAjaxSource": django_url + '/messages/listajax',
	                "fnServerData": function (sSource, aoData, fnCallback) {
	                    aoData.push({
	                        "name": "title",
	                        "value" : $('#msgtable_title').val()
	                    });
	                    aoData.push({
	                        "name": "text",
	                        "value" : $('#msgtable_text').val()
	                    });
	                    aoData.push({
	                        "name": "action",
	                        "value" : $('#msgtable_action').val()
	                    });
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
	                    possibleLengths,
	                    possibleLengthsLabels
	                ],
	                "bJQueryUI": true,
	                "aaSorting": [[ 2, "desc" ]],
	                "aoColumns": [
					  { // title
					      "bSearchable": true,
					      "bSortable": true
					  },
					  { // text
					      "bSearchable": true,
					      "bSortable": true
					  },
					  { // action
					      "bSearchable": true,
					      "bSortable": true
					  },
					  { // read
					      "sClass": "center",
					      "bSearchable": false,
					      "bSortable": false
					  }
					 ],
					 "aoColumnDefs": [
									     {
									    	 "fnRender" : function( oObj ) {
									    		 return '<b>' + oObj.aData[0] + '</b><br>' + oObj.aData[1];
									    	 },
									    	 "aTargets": [ 0 ]
									     }
									 ]
				});
	}
} 