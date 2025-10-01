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

    return Controller.extend("gateout.controller.GateOutDetail", {
        onInit() {
            this.oParameters = {
                "$top": 200000
            };
            let that = this;
            this.selectedPOSchAggrVendor = "";
            this.selected_Po_Scheduling_Type = undefined;
            this.selected_Po_Scheduling_Value = undefined;
            let oItemModel = new sap.ui.model.json.JSONModel({});
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
            const oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("RouteGateOutDetail").attachPatternMatched(this._onRouteMatched, this);
        },
        _onRouteMatched: function (oEvent) {
            let oModel = this.getView().getModel('selectedModel');
            if (!oModel) {
                this.getOwnerComponent().getRouter().navTo("RouteGateOutEdit", {
                }, true);
                return;
            }
            this.getView().setBusy(true);
            this._fetchGateOutData(oModel.getData()['GateEntryNo']);
            console.log(this.getView().getModel('selectedModel').getData());
        },


        _fetchGateOutData: function (sInvoiceNo) {
            let oModel = this.getOwnerComponent().getModel();
            let oView = this.getView();
            let that = this;
            this.InvoiceNo = sInvoiceNo;



            var oAndFilter = [
                new sap.ui.model.Filter("GateEntryNo", sap.ui.model.FilterOperator.EQ, sInvoiceNo),
            ];

            // Combine them with AND
            let aFilters = new sap.ui.model.Filter({
                filters: oAndFilter,
                and: true
            });

            // 3️⃣ Read dynamic entity
            oModel.read("/OutwardGateitm", {
                filters: [aFilters],
                // urlParameters: { "$expand": "to_ITEM" },
                success: function (oData) {


                    if (!oData.results.length) {
                        oView.getModel("header").setData([]);
                        oView.getModel("item").setData([]);
                        sap.m.MessageToast.show("No data found for Invoice " + sInvoiceNo);
                        return;
                    }
                    let aItems;

                    aItems = oData.results.map(function (oEntry) {
                        return Object.assign({}, oEntry);
                    });

                    oView.getModel("item").setData(aItems);
                    that.getView().setBusy(false);
                },
                error: function () {
                    that.getView().setBusy(false);
                    sap.m.MessageToast.show("Error fetching data.");
                }
            });
        },
        // onSave: function () {
        //     let oModel = this.getOwnerComponent().getModel(); // OData model
        //     let oView = this.getView();
        //     let plant = oView.byId("idDropdownPlant").getText()
        //     let that = this;

        //     let oHeaderData = oView.getModel("selectedModel").getData();
        //     let aItems = oView.getModel("item").getData();

        //     if (!this.validateRequiredFields()) {
        //         return; // stop save if validation fails
        //     }
        //     let oPayload = {

        //         Plant: plant,
        //         InvoiceNo: oHeaderData.InvoiceNumber,           // adapt field names as per metadata
        //         VehicleNo: oHeaderData.vehicleNumber,       // your XML is binding "vehicleNumber"
        //         VehicleType: oHeaderData.vehicleType,
        //         VehicleCapacity: oHeaderData.vehicleCapacity || "0.00",
        //         TransporterCode: oHeaderData.TransporterCode,
        //         to_Item: aItems.map(function (oItem) {
        //             return {
        //                 ItemNo: oItem.LineItem,             // check if backend expects padded "00010"
        //                 Zchalan: oHeaderData.InvoiceNumber,
        //                 Material: oItem.Material,
        //                 Uom: oItem.UoM,                     // in metadata it’s `Uom`
        //                 Quantity: oItem.InvoiceQuantity,     // in metadata it’s `Quantity`
        //             };
        //         })
        //     };

        //     // 4️⃣ POST to OData
        //     oModel.create("/OutwardGatehdr", oPayload, {
        //         success: function (oData) {
        //             sap.m.MessageToast.show("Gate Outward created successfully. No: " + oData.GateEntryNo);
        //             //  Now update gateout flag for this invoice
        //             // that._UpdateItemData(oData.InvoiceNo);
        //             that.onClearForm();

        //         },
        //         error: function (oError) {
        //             try {
        //                 // Parse responseText
        //                 var oResponse = JSON.parse(oError.responseText);

        //                 if (oResponse && oResponse.error && oResponse.error.message) {
        //                     var sMessage = oResponse.error.message.value; // "Invoice No. 90000000 already used"
        //                     sap.m.MessageToast.show(sMessage + ", Gate Outward creation cancelled !");
        //                 } else {
        //                     sap.m.MessageToast.show("An unexpected error occurred");
        //                 }
        //             } catch (e) {
        //                 sap.m.MessageToast.show("Error parsing response");
        //             }
        //         }
        //     });
        // },

        // onSave: function () {
        //     var oView = this.getView();
        //     var oModel = this.getOwnerComponent().getModel(); // OData V2 model
        //     var that = this;

        //     // Get selected header and item data
        //     var oHeaderData = oView.getModel("selectedModel").getData();
        //     var aItems = oView.getModel("item").getData();

        //     if (!this.validateRequiredFields()) return;

        //     // Prepare header payload
        //     var oHeaderPayload = {
        //         VehicleNo: oHeaderData.VehicleNo,
        //         VehicleType: oHeaderData.VehicleType,
        //         VehicleCapacity: oHeaderData.VehicleCapacity || "0.00",
        //         TransporterCode: oHeaderData.TransporterCode
        //     };

        //     // Enable batch
        //     oModel.setUseBatch(true);

        //     var sGateEntryNo = oHeaderData.GateEntryNo;

        //     // 1️⃣ Update header in batch
        //     oModel.update("/OutwardGatehdr('" + sGateEntryNo + "')", oHeaderPayload, {
        //         groupId: "batchGateOut",
        //         success: function () {
        //             // Optional: console.log("Header updated successfully");
        //         },
        //         error: function (oError) {
        //             sap.m.MessageToast.show("Header update failed");
        //             console.error(oError);
        //         }
        //     });

        //     // 2️⃣ Update each item in the same batch
        //     aItems.forEach(function (oItem) {
        //         var oItemPayload = {
        //             Quantity: parseFloat(oItem.InvoiceQuantity),
        //         };

        //         oModel.update(
        //             "/OutwardGateitm('"+sGateEntryNo+"')",
        //             oItemPayload,
        //             { groupId: "batchGateOut" }
        //         );
        //     });

        //     // 3️⃣ Submit batch changes
        //     oModel.submitChanges({
        //         groupId: "batchGateOut",
        //         success: function (oData, oResponse) {
        //             sap.m.MessageToast.show("Gate Outward updated successfully: " + sGateEntryNo);
        //             that.onClearForm();
        //         },
        //         error: function (oError) {
        //             sap.m.MessageToast.show("Batch update failed");
        //             console.error(oError);
        //         }
        //     });
        // },

        onSave: function () {
            let oModel = this.getOwnerComponent().getModel(); // OData model
            let oView = this.getView();
            let plant = oView.byId("idDropdownPlant").getText();
            let that = this;

            let oHeaderData = oView.getModel("selectedModel").getData();
            let aItems = oView.getModel("item").getData();

            if (!this.validateRequiredFields()) {
                return; // stop save if validation fails
            }

            // Prepare payload for header
            let oHeaderPayload = {
                VehicleNo: oHeaderData.VehicleNo,
                VehicleType: oHeaderData.vehicleType,
                VehicleCapacity: oHeaderData.vehicleCapacity || "0.00",
                TransporterCode: oHeaderData.TransporterCode
            };

            // 1️⃣ Update header first
            let sHeaderPath = `/OutwardGatehdr('${oHeaderData.GateEntryNo}')`; // Path for update using GateEntryNo
            oModel.update(sHeaderPath, oHeaderPayload, {
                success: function (oHeaderResponse) {
                    sap.m.MessageToast.show("Gate Outward header updated successfully. No: " + oHeaderResponse);

                    // 2️⃣ Now update each item
                    let aItemUpdates = aItems.map(function (oItem) {
                        let sItemPath = `/OutwardGateitm('${oHeaderData.GateEntryNo}')`;
                        let oItemPayload = {
                            Quantity: Number(parseFloat(oItem.Quantity).toFixed(2))
                        };

                        return new Promise(function (resolve, reject) {
                            oModel.update(sItemPath, oItemPayload, {
                                success: function (oItemResp) {
                                    resolve(oItemResp);
                                },
                                error: function (oItemErr) {
                                    reject(oItemErr);
                                }
                            });
                        });
                    });

                    // Wait for all items to be updated
                    Promise.allSettled(aItemUpdates).then(function (results) {
                        let failedItems = results.filter(r => r.status === "rejected");
                        if (failedItems.length === 0) {
                            sap.m.MessageToast.show("All items updated successfully!");
                            that.onClearForm();
                            that.getOwnerComponent().getRouter().navTo("RouteGateOutEdit", {
                            }, true);
                        } else {
                            sap.m.MessageToast.show(failedItems.length + " items failed to update.");
                        }

                    });

                },
                error: function (oError) {
                    try {
                        var oResponse = JSON.parse(oError.responseText);
                        if (oResponse && oResponse.error && oResponse.error.message) {
                            var sMessage = oResponse.error.message.value;
                            sap.m.MessageToast.show(sMessage + ", Gate Outward header update cancelled!");
                        } else {
                            sap.m.MessageToast.show("An unexpected error occurred while updating header.");
                        }
                    } catch (e) {
                        sap.m.MessageToast.show("Error parsing header update response");
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
            var oPage = oView.byId("page3");

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
            var oVehicleNo = oView.byId("_IDGenInput");
            var oVehicleType = oView.byId("_IDGenInput1");
            var oVehicleCapacity = oView.byId("_IDGenInput2");
            var oTransporterCode = oView.byId("_IDGenInput3");



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
        },
        onNavBack: function () {
            this.getOwnerComponent().getRouter().navTo("RouteGateOutEdit", {}, true); // replace with actual route
        },



    });
});