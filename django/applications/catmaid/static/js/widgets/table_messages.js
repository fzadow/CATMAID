
var MessagesTable = new function()
{
	this.messagesTable = null;
	var self = this;

	var possibleLengths = [25, 100, 500, 2000, -1];
	var possibleLengthsLabels = possibleLengths.map(
		function (n) { return (n === -1) ? "All" : n.toString(); });	

	this.init = function() {
		var tableid = '#msgtable';

		function format( rowdata ) {
			return '<i>' + rowdata[1] + '</i>';
		}

		self.messagesTable = $(tableid).DataTable(
				{
					"ordering": false,
					"dom": '<"H"lrf>t<"F"ip>',
					"lengthMenu" : [
							possibleLengths,
							possibleLengthsLabels
					],
					"pageLength": possibleLengths[0],
					"autoWidth": false,
					"searching": true,
					"stateSave": true,
					"processing": true,
					"serverSide": true,
					"jQueryUI": true,
					"ajax" : {
						"url" : django_url + 'messages/listajax',
						"type" : "POST"
					},
					"columns" : [
							{
								"name" : "Title",
								"searchable" : true,
								"sortable" : false
							}, {
								"name" : "Content",
								"searchable" : true,
								"visible" : false
							}, {
								"name" : "Action",
								"searchable" : true,
								"sortable" : false,
								"visible" : false
							}, {
								"name" : "Read",
								"searchable" : false,
								"visible" : false
							}, {
								"sortable" : false,
								"visible" : true,
								"width" : "1%",
								"className" : "nobr"
							}, {
								"visible" : false
							}
					],
					"pagingType": "simple_numbers",
					"createdRow": function( row, data, index ) {
						if( data[3] == false ) {
							$(row).addClass('highlight');
							$('td', row).eq(0).prepend('<span class="message-icon">●</span> ');
						}
						else {
							$('td', row).eq(0).prepend('<span class="message-icon">○</span> ');
						}
					}
				});

		
		// Add event listener for opening and closing details
		$(tableid + ' tbody').on('click', 'td', function () {
			var tr = $(this).closest('tr');
			var row = self.messagesTable.row( tr );

			// make read if unread
			if( row.data()[3] == false ) {
				requestQueue.register( django_url + 'messages/mark_read?id=' + row.data()[5], 'GET', undefined, function( status, data, text ) {
					row.invalidate().draw();
				} );
			}

			if( row.data()[1] !== "" ) { // if message has a "body"	
				if ( row.child.isShown() ) {
					// This row is already open - close it
					row.child.hide();
					tr.removeClass('shown');
				}
				else {
					// Open this row
					row.child( format(row.data()) ).show();
					tr.addClass('shown');
				}
			}
		} );
	}
} 
