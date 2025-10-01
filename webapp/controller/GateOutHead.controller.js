sap.ui.define([
	'sap/ui/core/mvc/Controller',
	'sap/ui/model/json/JSONModel',
	'sap/m/p13n/Engine',
	'sap/m/p13n/SelectionController',
	'sap/m/p13n/SortController',
	'sap/m/p13n/GroupController',
	'sap/m/p13n/FilterController',
	'sap/m/p13n/MetadataHelper',
	'sap/ui/model/Sorter',
	'sap/m/ColumnListItem',
	'sap/m/Text',
	'sap/ui/core/library',
	'sap/m/table/ColumnWidthController',
	'sap/ui/model/Filter',
	'gateout/utils/Formatter',
	'sap/m/MessageBox',
	"sap/ui/core/format/DateFormat",
	"sap/ui/comp/valuehelpdialog/ValueHelpDialog",
], function (Controller, JSONModel, Engine, SelectionController, SortController, GroupController, FilterController, MetadataHelper, Sorter, ColumnListItem, Text, coreLibrary, ColumnWidthController, Filter, Formatter, MessageBox, DateFormat, ValueHelpDialog) {
	"use strict";

	return Controller.extend("gateout.controller.GateOutHead", {

		onInit: function () {
			this._iPageSize = 100;       // number of items per batch
			this._iPage = 0;             // current page index
			this._bAllDataLoaded = false;
			this._bSkipFirstUpdate = false;  // skip the first updateStarted

			// Initialize models
			var oJsonModel = new sap.ui.model.json.JSONModel([]);
			this.getOwnerComponent().setModel(oJsonModel, "getListReport");

			var oSelectedModel = new sap.ui.model.json.JSONModel([]);
			this.getOwnerComponent().setModel(oSelectedModel, "selectedModel");

			// PlantModel should also live at Component level so it can be reused
			let cPlantModel;

			if (!this.getOwnerComponent().getModel("PlantModel")) {
				cPlantModel = new sap.ui.model.json.JSONModel([]);
				this.getOwnerComponent().setModel(cPlantModel, "PlantModel");
			}
			this.getView().setModel(this.getOwnerComponent().getModel("PlantModel"), 'PlantModel');
			this._aCurrentFilters = [];
			let oPlantModel = this.getOwnerComponent().getModel("PlantModel");
			// 🔹 Check if PlantModel has data
			var aPlantData = oPlantModel.getData();
			if (!aPlantData || (Array.isArray(aPlantData) && aPlantData.length === 0)) {
				this.getPlantData(); // fetch Plant data if empty
			}else{
				this._loadBillingDocumentData(null, true);
			}

			// Load first batch of data
			

			// Attach route pattern matched
			const oRouter = this.getOwnerComponent().getRouter();
			oRouter.getRoute("RouteGateOutEdit").attachPatternMatched(this._onRouteMatched, this);
		},

		_onRouteMatched: function (oEvent) {
			if (this._iPage !== 0) {
				this.getView().setBusy(false);
			} else {
				this.getView().setBusy(true);
			}


		},
		getPlantData: function () {
			let oModel = this.getOwnerComponent().getModel("vendorModel");
			let oPlantModel = this.getOwnerComponent().getModel('PlantModel');
			let sUser = sap.ushell?.Container?.getUser().getId() || "CB9980000018";
			let aFilters = [new sap.ui.model.Filter("Userid", "EQ", sUser)];
			let that=this;

			oModel.read("/UserIdToPlant", {
				filters: aFilters,
				urlParameters: {
					"$top": 1000,
					"$skip": 0
				},
				success: (oData) => {
					oPlantModel.setData(oData.results)
					that._loadBillingDocumentData(null, true);
				},
				error: () => {
					sap.m.MessageToast.show("Error fetching Plants.");
				}
			});
		},
		formatter: Formatter,

		onInvoiceValueHelp: function () {
			var that = this;

			// ===================================================
			// 1. Define columns for Value Help
			// ===================================================
			var aCols = [
				{ label: "Invoice No", path: "InvoiceNo", width: "12rem" },
				// { label: "Customer Name", path: "CustomerName", width: "12rem" }
			];

			// ===================================================
			// 2. Create the ValueHelpDialog
			// ===================================================
			var oVHD = new ValueHelpDialog({
				title: "Select Invoice no",
				supportMultiselect: true,
				key: "InvoiceNo",            // key field
				descriptionKey: "InvoiceNo", // field shown in description
				ok: function (e) {
					var aTokens = e.getParameter("tokens"); // all selected tokens
					var oMultiInput = that.byId("idAccountingDocument");

					// Remove existing tokens
					oMultiInput.removeAllTokens();

					// Add all selected tokens
					aTokens.forEach(function (oToken) {
						oMultiInput.addToken(new sap.m.Token({
							key: oToken.getKey(),
							text: oToken.getText()
						}));
					});

					// Fire change event with combined keys (optional)
					var sCombined = aTokens.map(t => t.getKey()).join(", ");
					oMultiInput.fireChange({
						value: sCombined,
						newValue: sCombined,
						valid: true
					});

					oVHD.close();
				},
				cancel: function () { oVHD.close(); },
				afterClose: function () { oVHD.destroy(); }
			});

			// ===================================================
			// 3. Configure Table inside ValueHelpDialog
			// ===================================================
			var oTable = oVHD.getTable();
			// Build mandatory filter for DocumentType
			// var oDocTypeFilter = new sap.ui.model.Filter("BillingDocumentType", sap.ui.model.FilterOperator.EQ, sDocType);
			// Add columns and row/item binding depending on table type
			if (oTable.bindRows) {
				// Grid Table (sap.ui.table.Table)
				aCols.forEach(c => oTable.addColumn(new sap.ui.table.Column({
					label: c.label,
					template: new sap.m.Text({ text: "{" + c.path + "}" }),
					width: c.width
				})));
				oTable.bindRows({ path: "/OutwardGatehdr" });
			} else {
				// Responsive Table (sap.m.Table)
				aCols.forEach(c => oTable.addColumn(new sap.m.Column({
					OutwardGatehdr: new sap.m.Label({ text: c.label })
				})));
				oTable.bindItems({
					path: "/OutwardGatehdr",
					template: new sap.m.ColumnListItem({
						cells: aCols.map(c => new sap.m.Text({ text: "{" + c.path + "}" }))
					})
				});
			}

			// ===================================================
			// 4. Central Search Function
			// ===================================================
			var fnDoSearch = function (sQuery) {
				sQuery = (sQuery || "").trim();

				var sAgg = oTable.bindRows ? "rows" : "items";
				var oBinding = oTable.getBinding(sAgg);

				if (!sQuery) {
					// Clear filters if query empty
					oBinding.filter([]);
					return;
				}

				// --- Step A: Try client-side filtering ---
				var aFilters = aCols.map(c =>
					new sap.ui.model.Filter(c.path, sap.ui.model.FilterOperator.Contains, sQuery)
				);

				// combine them with OR
				var oOrFilter = new sap.ui.model.Filter({
					filters: aFilters,
					and: false
				});

				oBinding.filter([oOrFilter], "Application");

				// --- Step B: If no results, fallback to server-side search ---
				if (oBinding.getLength() === 0) {
					var oModel = that.getView().getModel();
					// Server-side (ODataModel)
					oModel.read("/OutwardGatehdr", {
						filters: [oOrFilter],        // <-- use Filter object, not string
						urlParameters: { "$top": 200 },
						success: function (oData) {
							var oJson = new sap.ui.model.json.JSONModel({
								OutwardGatehdr: oData.results
							});
							oTable.setModel(oJson);
							// rebind to make sure busy state clears
							if (oTable.bindRows) {
								oTable.bindRows({ path: "/OutwardGatehdr" });
							} else {
								oTable.bindItems({
									path: "/OutwardGatehdr",
									template: new sap.m.ColumnListItem({
										cells: aCols.map(c => new sap.m.Text({ text: "{" + c.path + "}" }))
									})
								});
							}
							oTable.setBusy(false);
							oVHD.setBusy(false);
						},
						error: function () {
							sap.m.MessageToast.show("Server search failed");
						}
					});
				}
			};

			// ===================================================
			// 5. SearchField + FilterBar Setup
			// ===================================================
			var oBasicSearch = new sap.m.SearchField({
				width: "100%",
				search: function (oEvt) {   // triggers on Enter or search icon
					fnDoSearch(oEvt.getSource().getValue());
				}
				// Optional: add liveChange if you want instant typing search
				// liveChange: function (oEvt) {
				//     fnDoSearch(oEvt.getSource().getValue());
				// }
			});

			var oFilterBar = new sap.ui.comp.filterbar.FilterBar({
				advancedMode: true,
				search: function () {
					fnDoSearch(oBasicSearch.getValue());
				}
			});
			oFilterBar.setBasicSearch(oBasicSearch);
			oVHD.setFilterBar(oFilterBar);

			// ===================================================
			// 6. Prefill Search with existing value (if any)
			// ===================================================
			var sPrefill = this.byId("idAccountingDocument").getValue();
			oBasicSearch.setValue(sPrefill);
			oVHD.setBasicSearchText(sPrefill);

			// ===================================================
			// 7. Attach model and open dialog
			// ===================================================
			oTable.setModel(this.getView().getModel());
			oVHD.open();
		},
		onAsnValueHelp: function () {
			var that = this;

			// ===================================================
			// 1. Define columns for Value Help
			// ===================================================
			var aCols = [
				{ label: "Gate Entry", path: "GateEntryNo", width: "12rem" },
				// { label: "Customer Name", path: "CustomerName", width: "12rem" }
			];

			// ===================================================
			// 2. Create the ValueHelpDialog
			// ===================================================
			var oVHCustomer = new ValueHelpDialog({
				title: "Select Gate Entry",
				supportMultiselect: true,
				key: "GateEntryNo",            // key field
				descriptionKey: "GateEntryNo", // field shown in description
				ok: function (e) {
					var aTokens = e.getParameter("tokens"); // all selected tokens
					var oMultiInput = that.byId("idCustomer");

					// Remove existing tokens before adding new ones
					oMultiInput.removeAllTokens();

					// Add all selected tokens
					aTokens.forEach(function (oToken) {
						oMultiInput.addToken(new sap.m.Token({
							key: oToken.getKey(),
							text: oToken.getText()
						}));
					});

					// Fire change event with combined values (optional)
					var sCombined = aTokens.map(t => t.getKey()).join(", ");
					oMultiInput.fireChange({
						value: sCombined,
						newValue: sCombined,
						valid: true
					});

					oVHCustomer.close();
				},
				cancel: function () { oVHCustomer.close(); },
				afterClose: function () { oVHCustomer.destroy(); }
			});

			// ===================================================
			// 3. Configure Table inside ValueHelpDialog
			// ===================================================
			var oTable = oVHCustomer.getTable();
			// Build mandatory filter for DocumentType
			// var oDocTypeFilter = new sap.ui.model.Filter("BillingDocumentType", sap.ui.model.FilterOperator.EQ, sDocType);
			// Add columns and row/item binding depending on table type
			if (oTable.bindRows) {
				// Grid Table (sap.ui.table.Table)
				aCols.forEach(c => oTable.addColumn(new sap.ui.table.Column({
					label: c.label,
					template: new sap.m.Text({ text: "{" + c.path + "}" }),
					width: c.width
				})));
				oTable.bindRows({
					path: "/OutwardGatehdr",
					//  filters: [oDocTypeFilter] 
				});
			} else {
				// Responsive Table (sap.m.Table)
				aCols.forEach(c => oTable.addColumn(new sap.m.Column({
					OutwardGatehdr: new sap.m.Label({ text: c.label })
				})));
				oTable.bindItems({
					path: "/OutwardGatehdr",
					template: new sap.m.ColumnListItem({
						cells: aCols.map(c => new sap.m.Text({ text: "{" + c.path + "}" }))
					})
				});
			}

			// ===================================================
			// 4. Central Search Function
			// ===================================================
			var fnDoSearch = function (sQuery) {
				sQuery = (sQuery || "").trim();

				var sAgg = oTable.bindRows ? "rows" : "items";
				var oBinding = oTable.getBinding(sAgg);

				if (!sQuery) {
					// Clear filters if query empty
					oBinding.filter([]);
					return;
				}

				// --- Step A: Try client-side filtering ---
				var aFilters = aCols.map(c =>
					new sap.ui.model.Filter(c.path, sap.ui.model.FilterOperator.Contains, sQuery)
				);

				// combine them with OR
				var oOrFilter = new sap.ui.model.Filter({
					filters: aFilters,
					and: false
				});

				oBinding.filter([oOrFilter], "Application");

				// --- Step B: If no results, fallback to server-side search ---
				if (oBinding.getLength() === 0) {
					var oModel = that.getView().getModel();
					// Server-side (ODataModel)
					oModel.read("/OutwardGatehdr", {
						filters: [oOrFilter],        // <-- use Filter object, not string
						urlParameters: { "$top": 200 },
						success: function (oData) {
							var oJson = new sap.ui.model.json.JSONModel({
								OutwardGatehdr: oData.results
							});
							oTable.setModel(oJson);
							// rebind to make sure busy state clears
							if (oTable.bindRows) {
								oTable.bindRows({ path: "/OutwardGatehdr" });
							} else {
								oTable.bindItems({
									path: "/OutwardGatehdr",
									template: new sap.m.ColumnListItem({
										cells: aCols.map(c => new sap.m.Text({ text: "{" + c.path + "}" }))
									})
								});
							}
							oTable.setBusy(false);
							oVHCustomer.setBusy(false);
						},
						error: function () {
							sap.m.MessageToast.show("Server search failed");
						}
					});
				}
			};

			// ===================================================
			// 5. SearchField + FilterBar Setup
			// ===================================================
			var oBasicSearch = new sap.m.SearchField({
				width: "100%",
				search: function (oEvt) {   // triggers on Enter or search icon
					fnDoSearch(oEvt.getSource().getValue());
				}
				// Optional: add liveChange if you want instant typing search
				// liveChange: function (oEvt) {
				//     fnDoSearch(oEvt.getSource().getValue());
				// }
			});

			var oFilterBar = new sap.ui.comp.filterbar.FilterBar({
				advancedMode: true,
				search: function () {
					fnDoSearch(oBasicSearch.getValue());
				}
			});
			oFilterBar.setBasicSearch(oBasicSearch);
			oVHCustomer.setFilterBar(oFilterBar);

			// ===================================================
			// 6. Prefill Search with existing value (if any)
			// ===================================================
			var sPrefill = this.byId("idCustomer").getValue();
			oBasicSearch.setValue(sPrefill);
			oVHCustomer.setBasicSearchText(sPrefill);

			// ===================================================
			// 7. Attach model and open dialog
			// ===================================================
			oTable.setModel(this.getView().getModel());
			oVHCustomer.open();
		},

		_loadBillingDocumentData: function (aFilters, bReset) {
			var that = this;

			if (bReset) {
				this._iPage = 0;
				this._bAllDataLoaded = false;
			}

			if (this._bAllDataLoaded) return;

			if (!this._bSkipFirstUpdate) {
				this.getView().setBusy(true);
			}

			let oModel = this.getOwnerComponent().getModel();
			let iSkip = this._iPage * this._iPageSize;

			// 🔹 Mandatory Plant filter from PlantModel
			// 🔹 Mandatory Plant filter from PlantModel
			let aPlantData = this.getOwnerComponent().getModel("PlantModel").getData();
			let oPlantFilter;
			// Ensure array is valid
			if (Array.isArray(aPlantData) && aPlantData.length > 0) {
				let aPlantFilters = aPlantData
					.map(function (oItem) {
						return new sap.ui.model.Filter("Plant", sap.ui.model.FilterOperator.EQ, oItem.Plant);
					});

				// Combine with OR logic (any plant matches)
				oPlantFilter = new sap.ui.model.Filter({
					filters: aPlantFilters,
					and: false
				});


			} else {
				MessageBox.error("No Plant data available in PlantModel");
				return;
			}


			// Merge mandatory Plant filter with incoming filters
			let aAllFilters = [oPlantFilter];
			if (aFilters && aFilters.length) {
				aAllFilters = aAllFilters.concat(aFilters);
			} else if (that._aCurrentFilters && that._aCurrentFilters.length) {
				aAllFilters = aAllFilters.concat(that._aCurrentFilters);
			}

			oModel.read("/OutwardGatehdr", {
				urlParameters: {
					"$top": this._iPageSize,
					"$skip": iSkip
				},
				filters: aAllFilters,
				success: function (oData) {
					let oListModel = that.getOwnerComponent().getModel("getListReport");

					if (bReset || !that._iPage) {
						// First page (or filter applied): reset data
						oListModel.setData(oData.results);
					} else {
						// Append data for paging
						let aExisting = oListModel.getData();
						oListModel.setData(aExisting.concat(oData.results));
					}

					// If fewer than page size → no more data
					if (oData.results.length < that._iPageSize) {
						that._bAllDataLoaded = true;
					}

					that._iPage++;
					that.getView().setBusy(false);
				},
				error: function (oError) {
					that.getView().setBusy(false);
					MessageBox.error("Failed to load Billing Document data");
					console.error("OData Error: ", oError);
				}
			});
		},
		onUpdateStartPoHeaderTable: function (oEvent) {
			if (!this._bSkipFirstUpdate) {
				// First binding, skip loading
				this._bSkipFirstUpdate = true;  // skip the first updateStarted
				return;
			}
			// Check if it's really a scroll (reason = Growing)
			if (oEvent.getParameter("reason") === "Growing" && !this._bAllDataLoaded) {
				this._loadBillingDocumentData(null, false);
			}
		},

		onFilterGo: function (oEvent) {
			this.getView().setBusy(true);
			var oFilterBar = this.byId("idFilterBar"); // your filterbar id
			var oModel = this.getOwnerComponent().getModel(); // OData Model
			var aFilters = [];
			let oDateFormat = DateFormat.getInstance({
				pattern: "yyyy-MM-dd"
			});

			// ====== Invoice Number (MultiInput) ======
			var oBillingInput = this.byId("idAccountingDocument");
			var aBillingDocs = oBillingInput.getTokens();
			var sBillingRaw = oBillingInput.getValue(); // NEW: catch raw typed value

			if (aBillingDocs.length > 0) {
				aBillingDocs.forEach(function (oToken) {
					aFilters.push(new sap.ui.model.Filter(
						"InvoiceNo",
						sap.ui.model.FilterOperator.EQ,
						oToken.getKey() || oToken.getText()
					));
				});
			}
			// if user typed directly without pressing enter
			if (sBillingRaw) { // NEW
				aFilters.push(new sap.ui.model.Filter(
					"InvoiceNo",
					sap.ui.model.FilterOperator.Contains,
					sBillingRaw
				));
			}

			// // ====== Document Date (DateRangeSelection) ======
			// var oDateRange = this.byId("idPostingDate");
			// if (oDateRange.getDateValue() && oDateRange.getSecondDateValue()) {
			// 	aFilters.push(new sap.ui.model.Filter(
			// 		"invoice_date",
			// 		sap.ui.model.FilterOperator.BT,
			// 		oDateFormat.format(new Date(oDateRange.getDateValue())),
			// 		oDateFormat.format(new Date(oDateRange.getSecondDateValue()))
			// 	));
			// }

			// ====== Customer / ASN (MultiInput) ======
			var oAsnInput = this.byId("idCustomer");
			var aCustomers = oAsnInput.getTokens();
			var sAsnRaw = oAsnInput.getValue(); // NEW: catch raw typed ASN

			if (aCustomers.length > 0) {
				aCustomers.forEach(function (oToken) {
					aFilters.push(new sap.ui.model.Filter(
						"GateEntryNo",
						sap.ui.model.FilterOperator.EQ,
						oToken.getKey() || oToken.getText()
					));
				});
			}
			// if user typed directly without pressing enter
			if (sAsnRaw) { // NEW
				aFilters.push(new sap.ui.model.Filter(
					"GateEntryNo",
					sap.ui.model.FilterOperator.Contains,
					sAsnRaw
				));
			}

			this._aCurrentFilters = aFilters;

			// ====== Call OData Service ======
			this._loadBillingDocumentData(aFilters, true);
		},

		onLineItemPress: function (oEvent) {
			this.getView().setBusy(true);
			var oPressedItem = oEvent.getParameter("listItem"); // item that was pressed
			var oContext = oPressedItem.getBindingContext("getListReport"); // use your model name
			var oRowData = oContext.getObject();

			this.getOwnerComponent().getModel("selectedModel").setData(oRowData);

			this.onClickNext(); // navigate or next step
		},
		onClickNext: function () {
			this.getOwnerComponent().getRouter().navTo("RouteGateOutDetail", {
			}, true); // replace with actual route

		}

	});
});