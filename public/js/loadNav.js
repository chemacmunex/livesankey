$(document).ready(function() {
	$.get("navbar", function(data) {
		$("#navbar").html(data);
	});
});
