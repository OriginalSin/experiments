//Поддержка zoomControl
(function()
{

	var addZoomControl = function(cont)
	{
		var apiBase = gmxAPI.getAPIFolderRoot();
		var zoomParent = gmxAPI.newStyledDiv({
			position: "absolute",
			left: "40px",
			top: "-35px"
		});
		cont.appendChild(zoomParent);
		var zoomPlaque = gmxAPI.newStyledDiv({
			backgroundColor: "#016a8a",
			opacity: 0.5,
			position: "absolute",
			left: 0,
			top: 0
		});
		zoomParent.appendChild(zoomPlaque);

		zoomParent.appendChild(gmxAPI.newElement(
			"img",
			{
				src: apiBase + "img/zoom_minus.png",
				onclick: function()
				{
					gmxAPI.map.zoomBy(-1);
				},
				onmouseover: function()
				{
					this.src = apiBase + "img/zoom_minus_a.png";
				},
				onmouseout: function()
				{
					this.src = apiBase + "img/zoom_minus.png"
				}
			},
			{
				position: "absolute",
				left: "5px",
				top: "7px",
				cursor: "pointer"
			}
		));
		var zoomPlus = gmxAPI.newElement(
			"img",
			{
				src: apiBase + "img/zoom_plus.png",
				onclick: function()
				{
					gmxAPI.map.zoomBy(1);
				},
				onmouseover: function()
				{
					this.src = apiBase + "img/zoom_plus_a.png";
				},
				onmouseout: function()
				{
					this.src = apiBase + "img/zoom_plus.png"
				}
			},
			{
				position: "absolute",
				cursor: "pointer"
			}
		)
		zoomParent.appendChild(zoomPlus);

		var addZoomItem = function(i)
		{
			var zoomObj_ = gmxAPI.newElement(
				"img",
				{
					src: apiBase + "img/zoom_raw.png",
					title: "" + (i + 1),
					onclick: function()
					{
						gmxAPI.map.zoomBy(i + minZoom - gmxAPI.map.getZ());
					},
					onmouseover: function()
					{
						this.src = apiBase + "img/zoom_active.png";
						this.title = "" + (i + minZoom);
					},
					onmouseout: function()
					{
						this.src = (this == zoomObj) ? (apiBase + "img/zoom_active.png") : (apiBase + "img/zoom_raw.png");
					}
				},
				{
					position: "absolute",
					left: (22 + 12*i) + "px",
					top: "12px",
					width: "12px",
					height: "8px",
					border: 0,
					cursor: "pointer"
				}
			);
			zoomParent.appendChild(zoomObj_);
			zoomArr.push(zoomObj_);
		};

		var zoomArr = [];
		var zoomObj = null;
		for (var i = 0; i < 20; i++)
		{
			addZoomItem(i);
		}

		var minZoom = 1, maxZoom;
		gmxAPI.map.zoomControl = {
			isVisible: true,
			isMinimized: false,
			setVisible: function(flag)
			{
				gmxAPI.setVisible(zoomParent, flag);
				this.isVisible = flag;
				if('_timeBarPosition' in gmxAPI) gmxAPI._timeBarPosition();
			},
			setZoom: function(z)
			{
				var newZoomObj = zoomArr[Math.round(z) - minZoom];
				if (newZoomObj != zoomObj)
				{
					if (zoomObj) zoomObj.src = apiBase + "img/zoom_raw.png";
					zoomObj = newZoomObj;
					if (zoomObj) zoomObj.src = apiBase + "img/zoom_active.png";
				}
			},
			repaint: function()
			{
				var dz = maxZoom - minZoom + 1;
				var gap = this.isMinimized ? 8 : 12*dz;
				gmxAPI.position(zoomPlus, 20 + gap, 7);
				gmxAPI.size(zoomPlaque, 43 + gap, 32);
				gmxAPI.map.zoomControl.width = 43 + gap;
				for (var i = 0; i < dz; i++) {
					if(i == zoomArr.length) addZoomItem(i);
					gmxAPI.setVisible(zoomArr[i], !this.isMinimized && (i < dz));
				}
				if(dz < zoomArr.length) for (var i = dz; i < zoomArr.length; i++) gmxAPI.setVisible(zoomArr[i], false);
				if('_timeBarPosition' in gmxAPI) gmxAPI._timeBarPosition();
			},
			setMinMaxZoom: function(z1, z2)
			{
				minZoom = z1;
				maxZoom = z2;
				this.repaint();
			},
			getMinZoom: function()
			{
				return minZoom;
			},
			getMaxZoom: function()
			{
				return maxZoom;
			},
			minimize: function()
			{
				this.isMinimized = true;
				this.repaint();
			},
			maximize: function()
			{
				this.isMinimized = false;
				this.repaint();
			}
		}
		var cz = (gmxAPI.map.needMove ? gmxAPI.map.needMove.z || 1 : 4);
		gmxAPI.map.zoomControl.setZoom(cz);
		// Добавление прослушивателей событий
		gmxAPI.map.addListener('positionChanged', function(ph)
			{
				gmxAPI.map.zoomControl.setZoom(ph.currZ);
			}
		);
	}
	gmxAPI._addZoomControl = addZoomControl;
})();
