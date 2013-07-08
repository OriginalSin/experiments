//Поддержка geomixerLink
(function()
{
	var addGeomixerLink = function(cont)
	{
		var apiBase = gmxAPI.getAPIFolderRoot();
		var geomixerLink = gmxAPI.newElement(
			"a",
			{
				href: "http://geomixer.ru",
				target: "_blank",
				className: "gmx_geomixerLink"
			},
			{
				position: "absolute",
				left: "8px",
				bottom: "8px"
			}
		);
		geomixerLink.appendChild(gmxAPI.newElement(
			"img",
			{
				src: apiBase + "img/geomixer_logo_api.png",
				title: gmxAPI.KOSMOSNIMKI_LOCALIZED("© 2007-2011 ИТЦ «СканЭкс»", "(c) 2007-2011 RDC ScanEx"),
				width: 130,
				height: 34
			},
			{
				border: 0
			}
		));
		cont.appendChild(geomixerLink);
		gmxAPI.map.setGeomixerLinkAlign = function(attr) {				// Изменить позицию ссылки на Geomixer
			var align = attr['align'];
			if(align === 'br') {			// Позиция br(BottomRight)
				gmxAPI.setPositionStyle(geomixerLink, { 'top': '', 'bottom': '8px', 'right': '8px', 'left': '' });
			} else if(align === 'bl') {		// Позиция bl(BottomLeft)
				gmxAPI.setPositionStyle(geomixerLink, { 'top': '', 'bottom': '8px', 'right': '', 'left': '8px' });
			} else if(align === 'tr') {		// Позиция tr(TopRight)
				gmxAPI.setPositionStyle(geomixerLink, { 'top': '8px', 'bottom': '', 'right': '8px', 'left': '' });
			} else if(align === 'tl') {		// Позиция tl(TopLeft)
				gmxAPI.setPositionStyle(geomixerLink, { 'top': '8px', 'bottom': '', 'right': '', 'left': '8px' });
			}
		}
	}
	gmxAPI._addGeomixerLink = addGeomixerLink;
})();
