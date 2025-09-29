sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageBox",
    "sap/m/library",
    'sap/ui/core/library',
    "sap/ui/core/format/DateFormat",
    "sap/ui/comp/valuehelpdialog/ValueHelpDialog",
    "sap/ui/comp/filterbar/FilterBar",
    "sap/ui/comp/filterbar/FilterItem",
    "sap/m/Input",
    "sap/m/SearchField",
    "sap/m/MessageToast",
    "sap/ui/model/json/JSONModel",
], (Controller, MessageBox, mobileLibrary, coreLibrary, DateFormat, ValueHelpDialog, FilterBar, FilterItem, Input, SearchField, MessageToast, JSONModel) => {
    "use strict";


    let ValueState = coreLibrary.ValueState;
    //let dateFormat = sap.ui.core.format.DateFormat.getDateInstance({ pattern: "YYYY/MM/DD" });
    let ButtonType = mobileLibrary.ButtonType;

    return Controller.extend("gateout.controller.GateOut", {
        onInit() {
            this.oParameters = {
                "$top": 200000
            };
            let that = this;
            const oRouter = this.getOwnerComponent().getRouter();
            this.selectedPOSchAggrVendor = "";
            this.selected_Po_Scheduling_Type = undefined;
            this.selected_Po_Scheduling_Value = undefined;
            let oHeaderModel = new sap.ui.model.json.JSONModel({});
            let oItemModel = new sap.ui.model.json.JSONModel({});
            this.getView().setModel(oHeaderModel, "header");
            // Bind items
            this.getView().setModel(oItemModel, "item");

            let currentYear = new Date().getFullYear();
            let currentMonth = new Date().getMonth();
            if (currentMonth < 3) {
                currentYear = currentYear - 1;
            }
            var oViewModel = new sap.ui.model.json.JSONModel({
                headerExpanded: true
            });
            this.getView().setModel(oViewModel, "ExpandModel");
            // this.byId("idRAII_LR_Date").setMaxDate(new Date);
            this.f4HelpModel = this.getOwnerComponent().getModel("vendorModel");
            this.inGateEntryModel = this.getOwnerComponent().getModel("vendorModel");
            let tDate = new Date();
            let oDateFormat = DateFormat.getInstance({
                pattern: "yyyy-MM-dd"
            });
            let formattedDate = oDateFormat.format(tDate); //`${tDate.getFullYear()}/${String(tDate.getMonth() + 1).padStart(2, '0')}/${String(tDate.getDate()).padStart(2, '0')}`;
            this.byId("idRAII_Date").setValue(formattedDate);
            let currentTime = `${tDate.getHours()}:${tDate.getMinutes()}:${tDate.getSeconds()}`;
            this.byId("idRAII_Time").setValue(currentTime);
            this.getPlantData();
        },
        _onRouteMatched: function () { },
        onCategoryChange: function (oEvent) {
            let sKey = oEvent.getParameter("selectedItem").getKey();
            let oLabel = this.byId("idInvoiceLabel");
            this.getView().byId("idRAII_DocInvNo").setValue("");
            switch (sKey) {
                case "sto":
                    oLabel.setText("STO Invoice Number");
                    break;
                case "inv":
                    oLabel.setText("Invoice Number");
                    break;
                case "scn":
                    oLabel.setText("Sub Contract Challan Number");
                    break;
                case "rar":
                    oLabel.setText("Material Document");
                    break;
                default:
                    oLabel.setText("Invoice Number");
            }
        },
        onChangeRAII_DocInvNo: function (oEvent) {
            let sInvoiceNo = oEvent.getParameter("value") || "";
            // if (sInvoiceNo.length < 10) {
            //     sap.m.MessageToast.show("Invoice number must be 10 characters.");
            //     return;
            // }

            this._fetchGateOutData(sInvoiceNo);
        },


        _getEntityForCategory: function (sCategory) {
            switch (sCategory) {
                case "sto":
                    return "/JSTOSCREEN";     // STO Invoice entity
                case "inv":
                    return "/F2SCREEN"; // Normal Invoice entity
                case "scn":
                    return "/JSNSCREEN"; // Subcontract Challan entity
                case "rar":
                    return "/materialDocumentItem"; // Subcontract Challan entity
                default:
                    return "/F2SCREEN"; // fallback
            }
        },

        _fetchGateOutData: function (sInvoiceNo) {
            let oModel = this.getOwnerComponent().getModel();
            let oView = this.getView();
            let oPage = oView.byId("page");
            this.InvoiceNo = sInvoiceNo;
            oPage.setBusy(true);

            // 1️⃣ Get selected category
            let sCategory = oView.byId("idCategoryDropdown").getSelectedKey();
            let sEntitySet = this._getEntityForCategory(sCategory);
            let aFilters = [];
            // 2️⃣ Create filter
            if (sEntitySet !== '/materialDocumentItem') {
                aFilters = [
                    new sap.ui.model.Filter("InvoiceNumber", sap.ui.model.FilterOperator.EQ, sInvoiceNo)
                ];
            } else {
                var oAndFilter = [
                    new sap.ui.model.Filter("MaterialDocument", sap.ui.model.FilterOperator.EQ, sInvoiceNo),
                    new sap.ui.model.Filter("MaterialDocumentYear", sap.ui.model.FilterOperator.EQ, this.documentYear.split(' ')[0].trim()) // 👈 extra filter
                ];

                // Combine them with AND
                aFilters = new sap.ui.model.Filter({
                    filters: oAndFilter,
                    and: true
                });
            }
            // 3️⃣ Read dynamic entity
            oModel.read(sEntitySet, {
                filters: [aFilters],
                // urlParameters: { "$expand": "to_ITEM" },
                success: function (oData) {
                    oPage.setBusy(false);

                    if (!oData.results.length) {
                        oView.getModel("header").setData([]);
                        oView.getModel("item").setData([]);
                        sap.m.MessageToast.show("No data found for Invoice " + sInvoiceNo);
                        return;
                    }
                    let oHeader = oData.results[0];
                    let aItems;
                    oView.getModel("header").setData(oHeader);
                    if (sEntitySet !== '/materialDocumentItem') {
                        aItems = oData.results.map(function (oEntry) {
                            return Object.assign({}, oEntry, { InvoiceNumber: oHeader.InvoiceNumber });
                        });
                    } else {
                        aItems = oData.results.map(function (item) {
                            return {
                                LineItem: item.MaterialDocumentItem,
                                Material: item.Material,
                                InvoiceNumber:sInvoiceNo,
                                InvoiceQuantity: item.QuantityInBaseUnit,
                                UoM: item.MaterialBaseUnit // optional, if you need unit
                            };
                        });
                    }
                    oView.getModel("item").setData(aItems);
                },
                error: function () {
                    oPage.setBusy(false);
                    sap.m.MessageToast.show("Error fetching data.");
                }
            });
        },
        onSave: function () {
            let oModel = this.getOwnerComponent().getModel(); // OData model
            let oView = this.getView();
            let plant = oView.byId("idDropdownPlant").getSelectedKey()
            let that = this;

            let oHeaderData = oView.getModel("header").getData();
            let aItems = oView.getModel("item").getData();
            // if (oHeaderData.gateout === 'X') {
            //     sap.m.MessageToast.show("Gate Out already created for Invoice/Challan " + oHeaderData.InvoiceNumber);
            //     return;
            // }
            if (!this.validateRequiredFields()) {
                return; // stop save if validation fails
            }
            let oPayload = {

                Plant: plant,
                InvoiceNo: oHeaderData.InvoiceNumber,           // adapt field names as per metadata
                VehicleNo: oHeaderData.vehicleNumber,       // your XML is binding "vehicleNumber"
                VehicleType: oHeaderData.vehicleType,
                VehicleCapacity: oHeaderData.vehicleCapacity || "0.00",
                TransporterCode: oHeaderData.TransporterCode,
                to_Item: aItems.map(function (oItem) {
                    return {
                        ItemNo: oItem.LineItem,             // check if backend expects padded "00010"
                        Zchalan: oHeaderData.InvoiceNumber,
                        Material: oItem.Material,
                        Uom: oItem.UoM,                     // in metadata it’s `Uom`
                        Quantity: oItem.InvoiceQuantity,     // in metadata it’s `Quantity`
                    };
                })
            };

            // 4️⃣ POST to OData
            oModel.create("/OutwardGatehdr", oPayload, {
                success: function (oData) {
                    sap.m.MessageToast.show("Gate Outward created successfully. No: " + oData.GateEntryNo);
                    //  Now update gateout flag for this invoice
                    // that._UpdateItemData(oData.InvoiceNo);
                    that.onClearForm();

                },
                error: function (oError) {
                    try {
                        // Parse responseText
                        var oResponse = JSON.parse(oError.responseText);

                        if (oResponse && oResponse.error && oResponse.error.message) {
                            var sMessage = oResponse.error.message.value; // "Invoice No. 90000000 already used"
                            sap.m.MessageToast.show(sMessage + ", Gate Outward creation cancelled !");
                        } else {
                            sap.m.MessageToast.show("An unexpected error occurred");
                        }
                    } catch (e) {
                        sap.m.MessageToast.show("Error parsing response");
                    }
                }
            });
        },
        getPlantData: function () {
            let that = this;
            var oModel = this.getOwnerComponent().getModel();
            let plantModel = new sap.ui.model.json.JSONModel();
            //let odataModel = new sap.ui.model.odata.v2.ODataModel("NorthwindService/V2/(S(jjlmjbf1oszuuecc251trygy))/OData/OData.svc");
            oModel.read("/plantF4Help", {
                urlParameters: that.oParameters,
                success: function (oResponse) {
                    //MessageBox.success("Success");
                    plantModel.setData(oResponse.results);
                    that.getView().byId("idDropdownPlant").setModel(plantModel);
                },
                error: function (oError) {
                    MessageBox.error("Failed to load plant list");
                }
            });
        },
        _UpdateItemData: function (sInvoiceNo) {
            var oModel = this.getOwnerComponent().getModel();
            var oView = this.getView();
            var oPage = oView.byId("page");

            oPage.setBusy(true);

            // 1️⃣ Get entity set from category
            var sCategory = oView.byId("idCategoryDropdown").getSelectedKey();
            var sEntitySet = this._getEntityForCategory(sCategory);

            // 2️⃣ Build key path
            var sPath = oModel.createKey(sEntitySet, {
                InvoiceNumber: sInvoiceNo   // key from metadata
            });

            // 3️⃣ Payload for update
            var oUpdatePayload = {
                gateout: "X"
            };

            // 4️⃣ Update call
            oModel.update(sPath, oUpdatePayload, {
                success: function () {
                    oPage.setBusy(false);
                    sap.m.MessageToast.show("Invoice " + sInvoiceNo + " marked as Gate Out.");
                },
                error: function (oError) {
                    oPage.setBusy(false);
                    sap.m.MessageToast.show("Error updating Invoice " + sInvoiceNo);
                    console.log(oError);

                }
            });
        },

        // Controller handler
        // onValueHelpRequest: function () {
        //     var that = this;

        //     var oVHD = new sap.ui.comp.valuehelpdialog.ValueHelpDialog({
        //         title: "Select Item",
        //         supportMultiselect: false,                 // single key field
        //         key: "BillingDocument",                         // <-- your key property
        //         descriptionKey: "BillingDocument",
        //         ok: function (e) {
        //             var t = e.getParameter("tokens");
        //             var sKey = t.length ? t[0].getKey() : "";
        //             that.byId("idRAII_DocInvNo").setValue(sKey); // fill your filter/input
        //             oVHD.close();
        //         },
        //         cancel: function () { oVHD.close(); },
        //         afterClose: function () { oVHD.destroy(); }
        //     });

        //     // columns you want to show + search over
        //     var aCols = [
        //         { label: "Billing Document", path: "BillingDocument", width: "8rem" },
        //         // { label: "Name", path: "CompanyName", width: "18rem" },
        //         // { label: "City", path: "City", width: "10rem" }
        //     ];
        //     var oTable = oVHD.getTable();

        //     // Build columns + bind rows/items dynamically
        //     if (oTable.bindRows) {
        //         aCols.forEach(c => oTable.addColumn(new sap.ui.table.Column({
        //             label: c.label, template: new sap.m.Text({ text: "{" + c.path + "}" }), width: c.width
        //         })));
        //         oTable.bindRows({ path: "/billingdocumentf4" });          // OData v2/v4 path or JSON path
        //     } else {
        //         aCols.forEach(c => oTable.addColumn(new sap.m.Column({ header: new sap.m.Label({ text: c.label }) })));
        //         oTable.bindItems({
        //             path: "/billingdocumentf4",
        //             template: new sap.m.ColumnListItem({
        //                 cells: aCols.map(c => new sap.m.Text({ text: "{" + c.path + "}" }))
        //             })
        //         });
        //     }

        //     // ✅ Basic + advanced search lives on the FilterBar
        //     var oBasicSearch = new sap.m.SearchField({ width: "100%" });
        //     var oFilterBar = new sap.ui.comp.filterbar.FilterBar({
        //         advancedMode: true,
        //         search: function () {
        //             var sQuery = oBasicSearch.getValue().trim();
        //             var aFieldFilters = sQuery
        //                 ? aCols.map(c => new sap.ui.model.Filter(c.path, sap.ui.model.FilterOperator.Contains, sQuery))
        //                 : [];
        //             var oOr = aFieldFilters.length > 1
        //                 ? new sap.ui.model.Filter({ filters: aFieldFilters, and: false })
        //                 : aFieldFilters[0] || null;

        //             var sAggregation = oTable.bindRows ? "rows" : "items";
        //             var oBinding = oTable.getBinding(sAggregation);
        //             oBinding.filter(oOr ? [oOr] : [], "Application"); // OData => server-side; JSON => client-side
        //         }
        //     });
        //     oFilterBar.setBasicSearch(oBasicSearch);            // <-- correct place
        //     oVHD.setFilterBar(oFilterBar);

        //     // Optional: prefill from your input
        //     var sPrefill = this.byId("idRAII_DocInvNo").getValue();
        //     oBasicSearch.setValue(sPrefill);
        //     oVHD.setBasicSearchText(sPrefill);                  // just presets the text (string) on the dialog

        //     // Use your app’s model; OData models will auto-page & server-filter (>100 rows)
        //     oTable.setModel(this.getView().getModel());

        //     oVHD.open();
        // }

        // onValueHelpRequest: function () {
        //     var that = this;
        //     let sCategory = this.getView().byId("idCategoryDropdown").getSelectedKey();
        //     const mCategoryToDocType = {
        //         "sto": "JSTO", // STO Invoice entity
        //         "inv": "F2",   // Normal Invoice entity
        //         "scn": "JSN"   // Subcontract Challan entity
        //     };
        //     // ===================================================
        //     // 1. Define columns for Value Help
        //     // ===================================================
        //     var aCols = [
        //         { label: "Billing Document", path: "BillingDocument", width: "12rem" },
        //         { label: "Billing Document Type", path: "BillingDocumentType", width: "12rem" }
        //     ];



        //     let sDocType = mCategoryToDocType[sCategory] || "";
        //     // ===================================================
        //     // 2. Create the ValueHelpDialog
        //     // ===================================================
        //     var oVHD = new sap.ui.comp.valuehelpdialog.ValueHelpDialog({
        //         title: "Select Billing Document",
        //         supportMultiselect: false,
        //         key: "BillingDocument",            // key field
        //         descriptionKey: "BillingDocument", // field shown in description
        //         ok: function (e) {
        //             var t = e.getParameter("tokens");
        //             var sKey = t.length ? t[0].getKey() : "";
        //             that.byId("idRAII_DocInvNo").setValue(sKey);
        //             that.byId("idRAII_DocInvNo").fireChange({
        //                 value: sKey,
        //                 newValue: sKey,
        //                 valid: true
        //             });

        //             oVHD.close();
        //         },
        //         cancel: function () { oVHD.close(); },
        //         afterClose: function () { oVHD.destroy(); }
        //     });

        //     // ===================================================
        //     // 3. Configure Table inside ValueHelpDialog
        //     // ===================================================
        //     var oTable = oVHD.getTable();

        //     // Build mandatory filter for DocumentType
        //     var oDocTypeFilter = new sap.ui.model.Filter("BillingDocumentType", sap.ui.model.FilterOperator.EQ, sDocType);

        //     if (oTable.bindRows) {
        //         // Grid Table (sap.ui.table.Table)
        //         aCols.forEach(c => oTable.addColumn(new sap.ui.table.Column({
        //             label: c.label,
        //             template: new sap.m.Text({ text: "{" + c.path + "}" }),
        //             width: c.width
        //         })));

        //         oTable.bindRows({
        //             path: "/billingdocumentf4",
        //             filters: [oDocTypeFilter]   // ✅ Apply filter here
        //         });

        //     } else {
        //         // Responsive Table (sap.m.Table)
        //         aCols.forEach(c => oTable.addColumn(new sap.m.Column({
        //             header: new sap.m.Label({ text: c.label })
        //         })));

        //         oTable.bindItems({
        //             path: "/billingdocumentf4",
        //             filters: [oDocTypeFilter],   // ✅ Apply filter here
        //             template: new sap.m.ColumnListItem({
        //                 cells: aCols.map(c => new sap.m.Text({ text: "{" + c.path + "}" }))
        //             })
        //         });
        //     }

        //     // ===================================================
        //     // 4. Central Search Function
        //     // ===================================================
        //     var fnDoSearch = function (sQuery) {
        //         sQuery = (sQuery || "").trim();

        //         var sAgg = oTable.bindRows ? "rows" : "items";
        //         var oBinding = oTable.getBinding(sAgg);

        //         if (!sQuery) {
        //             // Clear filters if query empty
        //             oBinding.filter([]);
        //             return;
        //         }

        //         // --- Step A: Try client-side filtering ---
        //         var aFilters = aCols.map(c =>
        //             new sap.ui.model.Filter(c.path, sap.ui.model.FilterOperator.Contains, sQuery)
        //         );

        //         // combine them with OR
        //         var oOrFilter = new sap.ui.model.Filter({
        //             filters: aFilters,
        //             and: false
        //         });

        //         oBinding.filter([oOrFilter], "Application");
        //         var oDocTypeFilter = new sap.ui.model.Filter("BillingDocumentType", sap.ui.model.FilterOperator.EQ, sDocType);
        //         // --- Step B: If no results, fallback to server-side search ---
        //         if (oBinding.getLength() === 0) {
        //             var oModel = that.getView().getModel();
        //             // Server-side (ODataModel)
        //             oModel.read("/billingdocumentf4", {
        //                 filters: [oOrFilter, oDocTypeFilter],        // <-- use Filter object, not string
        //                 urlParameters: { "$top": 200 },
        //                 success: function (oData) {
        //                     var oJson = new sap.ui.model.json.JSONModel({
        //                         billingdocumentf4: oData.results
        //                     });
        //                     oTable.setModel(oJson);
        //                     // rebind to make sure busy state clears
        //                     if (oTable.bindRows) {
        //                         oTable.bindRows({ path: "/billingdocumentf4" });
        //                     } else {
        //                         oTable.bindItems({
        //                             path: "/billingdocumentf4",
        //                             template: new sap.m.ColumnListItem({
        //                                 cells: aCols.map(c => new sap.m.Text({ text: "{" + c.path + "}" }))
        //                             })
        //                         });
        //                     }
        //                     oTable.setBusy(false);
        //                     oVHD.setBusy(false);
        //                 },
        //                 error: function () {
        //                     sap.m.MessageToast.show("Server search failed");
        //                 }
        //             });
        //         }
        //     };

        //     // ===================================================
        //     // 5. SearchField + FilterBar Setup
        //     // ===================================================
        //     var oBasicSearch = new sap.m.SearchField({
        //         width: "100%",
        //         search: function (oEvt) {   // triggers on Enter or search icon
        //             fnDoSearch(oEvt.getSource().getValue());
        //         }
        //         // Optional: add liveChange if you want instant typing search
        //         // liveChange: function (oEvt) {
        //         //     fnDoSearch(oEvt.getSource().getValue());
        //         // }
        //     });

        //     var oFilterBar = new sap.ui.comp.filterbar.FilterBar({
        //         advancedMode: true,
        //         search: function () {
        //             fnDoSearch(oBasicSearch.getValue());
        //         }
        //     });
        //     oFilterBar.setBasicSearch(oBasicSearch);
        //     oVHD.setFilterBar(oFilterBar);

        //     // ===================================================
        //     // 6. Prefill Search with existing value (if any)
        //     // ===================================================
        //     var sPrefill = this.byId("idRAII_DocInvNo").getValue();
        //     oBasicSearch.setValue(sPrefill);
        //     oVHD.setBasicSearchText(sPrefill);

        //     // ===================================================
        //     // 7. Attach model and open dialog
        //     // ===================================================
        //     oTable.setModel(this.getView().getModel());
        //     oVHD.open();
        // },

        onValueHelpRequest: function () {
            var that = this;
            let sCategory = this.getView().byId("idCategoryDropdown").getSelectedKey();

            const mCategoryToDocType = {
                "sto": "JSTO", // STO Invoice entity
                "inv": "F2",   // Normal Invoice entity
                "scn": "JSN"   // Subcontract Challan entity
            };

            // ===================================================
            // 1. Define columns for Value Help
            // ===================================================
            var aCols, sEntity, sKeyField, sDescField, oDocTypeFilter;

            if (sCategory === "rar") {
                // ✅ RAR case
                aCols = [
                    { label: "Material Document", path: "MaterialDocument", width: "12rem" },
                    { label: "Material Document Year", path: "MaterialDocumentYear", width: "12rem" }
                ];
                sEntity = "/materialDocument";
                sKeyField = "MaterialDocument";   // only year goes to idRAII_DocInvNo
                sDescField = "MaterialDocumentYear";
                oDocTypeFilter = null; // no BillingDocumentType filter here
            } else {
                // ✅ Default case (billing document logic stays as-is)
                aCols = [
                    { label: "Billing Document", path: "BillingDocument", width: "12rem" },
                    { label: "Billing Document Type", path: "BillingDocumentType", width: "12rem" }
                ];
                sEntity = "/billingdocumentf4";
                sKeyField = "BillingDocument";
                sDescField = "BillingDocument";
                let sDocType = mCategoryToDocType[sCategory] || "";
                oDocTypeFilter = new sap.ui.model.Filter("BillingDocumentType", sap.ui.model.FilterOperator.EQ, sDocType);
            }

            // ===================================================
            // 2. Create the ValueHelpDialog
            // ===================================================
            var oVHD = new sap.ui.comp.valuehelpdialog.ValueHelpDialog({
                title: "Select Document",
                supportMultiselect: false,
                key: sKeyField,
                descriptionKey: sDescField,
                ok: function (e) {
                    var t = e.getParameter("tokens");
                    var sKey = t.length ? t[0].getKey() : "";
                    var stext = t.length ? t[0].getText() : "";
                    that.byId("idRAII_DocInvNo").setValue(sKey);
                    that.documentYear = stext;
                    that.byId("idRAII_DocInvNo").fireChange({
                        value: sKey,
                        newValue: sKey,
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

            if (oTable.bindRows) {
                // Grid Table (sap.ui.table.Table)
                aCols.forEach(c => oTable.addColumn(new sap.ui.table.Column({
                    label: c.label,
                    template: new sap.m.Text({ text: "{" + c.path + "}" }),
                    width: c.width
                })));

                oTable.bindRows({
                    path: sEntity,
                    filters: oDocTypeFilter ? [oDocTypeFilter] : []
                });

            } else {
                // Responsive Table (sap.m.Table)
                aCols.forEach(c => oTable.addColumn(new sap.m.Column({
                    header: new sap.m.Label({ text: c.label })
                })));

                oTable.bindItems({
                    path: sEntity,
                    filters: oDocTypeFilter ? [oDocTypeFilter] : [],
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
                    oBinding.filter([]);
                    return;
                }

                // --- Client-side filtering
                var aFilters = aCols.map(c =>
                    new sap.ui.model.Filter(c.path, sap.ui.model.FilterOperator.Contains, sQuery)
                );

                var oOrFilter = new sap.ui.model.Filter({ filters: aFilters, and: false });

                var aFinalFilters = oDocTypeFilter ? [oOrFilter, oDocTypeFilter] : [oOrFilter];
                oBinding.filter(aFinalFilters, "Application");

                // --- Server-side fallback
                if (oBinding.getLength() === 0) {
                    var oModel = that.getView().getModel();
                    oModel.read(sEntity, {
                        filters: aFinalFilters,
                        urlParameters: { "$top": 200 },
                        success: function (oData) {
                            var oJson = new sap.ui.model.json.JSONModel([]);
                            oJson.setProperty(sEntity, oData.results);
                            oTable.setModel(oJson);

                            if (oTable.bindRows) {
                                oTable.bindRows({ path: sEntity });
                            } else {
                                oTable.bindItems({
                                    path: sEntity,
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
                search: function (oEvt) {
                    fnDoSearch(oEvt.getSource().getValue());
                }
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
            var sPrefill = this.byId("idRAII_DocInvNo").getValue();
            oBasicSearch.setValue(sPrefill);
            oVHD.setBasicSearchText(sPrefill);

            // ===================================================
            // 7. Attach model and open dialog
            // ===================================================
            oTable.setModel(this.getView().getModel());
            oVHD.open();
        },
        onClearForm: function () {
            var oView = this.getView();

            // 1. Clear Invoice No. (MultiInput)
            var oInvoiceInput = oView.byId("idRAII_DocInvNo");
            if (oInvoiceInput) {
                oInvoiceInput.removeAllTokens();
                oInvoiceInput.setValue("");
            }

            // 2. Reset Date and Time with current values
            var oDateInput = oView.byId("idRAII_Date");
            var oTimeInput = oView.byId("idRAII_Time");
            var oNow = new Date();

            if (oDateInput) {
                oDateInput.setValue(oNow.toISOString().slice(0, 10)); // yyyy-mm-dd
            }
            if (oTimeInput) {
                oTimeInput.setValue(
                    oNow.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
                );
            }

            // 3. Clear Vehicle fields
            var aFieldIds = ["_IDGenInput", "_IDGenInput1", "_IDGenInput2", "_IDGenInput3"];
            aFieldIds.forEach(function (sId) {
                var oField = oView.byId(sId);
                if (oField) {
                    oField.setValue("");
                }
            });

            // 4. Clear table rows
            var oTable = oView.byId("idTable_RAII");
            if (oTable) {
                var oTableModel = oTable.getModel("item");
                if (oTableModel) {
                    oTableModel.setData([]); // reset table data
                }
            }

            // 5. Hide QR Code box
            var oVBoxQR = oView.byId("idVBox_QRCode");
            if (oVBoxQR) {
                oVBoxQR.setVisible(false);
            }
        },
        validateRequiredFields: function () {
            var oView = this.getView();
            var bValid = true;

            // Collect references
            var oPlant = oView.byId("idDropdownPlant");
            var oCategory = oView.byId("idCategoryDropdown");
            var oInvoice = oView.byId("idRAII_DocInvNo");
            var oVehicleNo = oView.byId("_IDGenInput");
            var oVehicleType = oView.byId("_IDGenInput1");
            var oVehicleCapacity = oView.byId("_IDGenInput2");
            var oTransporterCode = oView.byId("_IDGenInput3");

            // --- Plant ---
            if (!oPlant.getSelectedKey()) {
                oPlant.setValueState("Error").setValueStateText("Plant is required");
                bValid = false;
            } else {
                oPlant.setValueState("None");
            }

            // --- Category ---
            if (!oCategory.getSelectedKey()) {
                oCategory.setValueState("Error").setValueStateText("Category is required");
                bValid = false;
            } else {
                oCategory.setValueState("None");
            }

            // --- Invoice ---
            if (!oInvoice.getValue() && oInvoice.getTokens().length === 0) {
                oInvoice.setValueState("Error").setValueStateText("Invoice number is required");
                bValid = false;
            } else {
                oInvoice.setValueState("None");
            }

            // --- Vehicle Number ---
            if (!oVehicleNo.getValue().trim()) {
                oVehicleNo.setValueState("Error").setValueStateText("Vehicle number is required");
                bValid = false;
            } else {
                oVehicleNo.setValueState("None");
            }

            // --- Vehicle Type ---
            if (!oVehicleType.getValue().trim()) {
                oVehicleType.setValueState("Error").setValueStateText("Vehicle type is required");
                bValid = false;
            } else {
                oVehicleType.setValueState("None");
            }

            // --- Vehicle Capacity ---
            if (!oVehicleCapacity.getValue().trim()) {
                oVehicleCapacity.setValueState("Error").setValueStateText("Vehicle capacity is required");
                bValid = false;
            } else {
                oVehicleCapacity.setValueState("None");
            }

            // --- Transporter Code ---
            if (!oTransporterCode.getValue().trim()) {
                oTransporterCode.setValueState("Error").setValueStateText("Transporter code is required");
                bValid = false;
            } else {
                oTransporterCode.setValueState("None");
            }

            if (!bValid) {
                sap.m.MessageToast.show("Please fill all required fields.");
            }

            return bValid;
        }




    });
});