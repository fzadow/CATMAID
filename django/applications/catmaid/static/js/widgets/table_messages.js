
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
			var out = '<p>' + rowdata[1] + '</p>';
			
			// download action associated?
			if( rowdata[2] ) {
				out += '<p><a target="_blank" href="/' + rowdata[2] + '"><span class="ui-icon ui-icon-arrowthickstop-1-s">asd</span>' + rowdata[2].replace(/.*\/(.*)\/?/, "$1") + '</a></p>';
			}
			return out;
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
						if( data[3] == false )
							$(row).addClass('highlight');

						if( data[1] !== "" )
							$(row).addClass('hasbody');

						$('td', row).eq(0).prepend('<span class="message-icon"></span> ');
					}
				});

		// Event listener for filter checkbox
		$('#readfilter').on("click", function(e) {
			self.messagesTable.column(3)
				.search( $(this).is(':checked') )
				.draw();
		} );

		
		// Event listener for reading message / opening/closing details
		$(tableid + ' tbody').on('click', 'td', function (e) {
			var tr = $(this).closest('tr');
			var row = self.messagesTable.row( tr );

			// make read if unread
			if( tr.hasClass('highlight') ) {
				requestQueue.register( django_url + 'messages/'+row.data()[5]+'/read', 'POST', undefined, function( status, data, text ) {
					if( JSON.parse(data).success ) {
						tr.removeClass('highlight');
					}
				} );
			}

			// make unread if (read and) clicked on read/unread icon
			if( ! tr.hasClass('highlight') && e.originalEvent.toElement.nodeName == 'SPAN' ) {
				requestQueue.register( django_url + 'messages/'+row.data()[5]+'/unread', 'POST', undefined, function( status, data, text ) {
					if( JSON.parse(data).success ) {
						tr.addClass('highlight');
					}
				} );
				return; // to prevent message from opening
			}

			if( row.data()[1] !== "" ) { // if message has a "body"	
				if ( row.child.isShown() ) {
					row.child.hide();
					tr.removeClass('shown');
				}
				else {
					row.child( format(row.data()) ).show();
					tr.addClass('shown');
				}
			}
		} );
	}
} 
