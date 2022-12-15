"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mendixplatformsdk_1 = require("mendixplatformsdk");
const mendixmodelsdk_1 = require("mendixmodelsdk");
var model;
var adminRole;
var userRole;
main().catch(console.error);
async function main() {
    const client = new mendixplatformsdk_1.MendixPlatformClient();
    // Open the app
    const app = client.getApp("27084efc-8f89-4019-98e3-1b9bbc4d9257");
    // Open a working copy
    const workingCopy = await app.createTemporaryWorkingCopy("trunk");
    try {
        // Store the model globally as it's used everywhere...
        model = await workingCopy.openModel();
        // Find the module we want to change and error if not found
        const module = model.allModules().filter(module => module.name === "SDKModule")[0];
        if (module === undefined)
            throw new Error("Could not locate module SDKModule in the specified app");
        const domainModel = await module.domainModel.load();
        const desktopLayout = await retrieveLayout("Atlas_Core.Atlas_TopBar");
        const desktopLayoutPlaceholder = "Atlas_Core.Atlas_TopBar.Main";
        const popupLayout = await retrieveLayout("Atlas_Core.PopupLayout");
        const popupLayoutPlaceholder = "Atlas_Core.PopupLayout.Main";
        // Find the module roles
        adminRole = findModuleRole(module, "Admin");
        userRole = findModuleRole(module, 'User');
        // Find the entities
        const orderEntity = findEntity(domainModel, "Order");
        const orderLineEntity = findEntity(domainModel, "OrderLine");
        // Delete objects we are creating, if found
        await deleteOldPage("SDKModule.Order_Overview");
        await deleteOldPage("SDKModule.Order_NewEdit");
        await deleteOldPage("SDKModule.OrderLine_NewEdit");
        // Save our work so far
        await model.flushChanges();
        // Create the new/edit page for OrderLine first so it can be referenced form the grid in the order edit page
        const orderLineEntityNewEditPage = createEditPageForOrderLineEntity(orderLineEntity, popupLayout, popupLayoutPlaceholder);
        // Create Order new/edit page first so it can be referenced from overview
        const orderEntityNewEditPage = createEditPageForOrderEntity(orderEntity, popupLayout, popupLayoutPlaceholder, domainModel.associations, orderLineEntityNewEditPage);
        // Create overview page for Order. The data source and delete button are built outside the page first so they can be more easily changed
        const orderEntityOverviewPage = createOverviewPageForOrderEntity(orderEntity, "Order_Overview", "Order Overview", desktopLayout, desktopLayoutPlaceholder, orderEntityNewEditPage, orderEntityNewEditPage, "Order");
        // Add the Overview page to the menu
        const menuItemCollection = await findMenuItemCollection("Responsive");
        addToMenuItemCollection(menuItemCollection, "Order Overview", true, orderEntityOverviewPage);
        // All finished. Flush and commit changes
        await model.flushChanges();
        await workingCopy.commitToRepository("trunk", { commitMessage: "Update using Model SDK" });
        console.log(`Successfully committed revision: Done.`);
    }
    catch (error) {
        console.error("Something went wrong: ", error);
    }
}
function createEditPageForOrderLineEntity(entity, layout, layoutPlaceholderName) {
    // Set up the layout for the page
    const layoutCall = createLayoutCall(layout);
    const layoutCallArgument = createLayoutArgument(layoutCall, layoutPlaceholderName);
    // Build a simple layout grid
    const layoutGrid = mendixmodelsdk_1.pages.LayoutGrid.createInLayoutCallArgumentUnderWidgets(layoutCallArgument);
    layoutGrid.name = "OrderLine_NewEdit_LayoutGrid";
    layoutGrid.appearance = mendixmodelsdk_1.pages.Appearance.create(model);
    const layoutGridRow = mendixmodelsdk_1.pages.LayoutGridRow.createIn(layoutGrid);
    layoutGridRow.appearance = mendixmodelsdk_1.pages.Appearance.create(model);
    layoutGridRow.spacingBetweenColumns = true;
    const layoutGridColumn = mendixmodelsdk_1.pages.LayoutGridColumn.createIn(layoutGridRow);
    layoutGridColumn.weight = -1;
    layoutGridColumn.tabletWeight = -1;
    layoutGridColumn.phoneWeight = -1;
    layoutGridColumn.appearance = mendixmodelsdk_1.pages.Appearance.create(model);
    // Create a table to hold the attributes in the dataview
    const table = createTable("OrderLine_NewEdit_Table");
    createTableColumn(table, 33);
    createTableColumn(table, 67);
    // Create the dataview and drop in the table
    const dataView = mendixmodelsdk_1.pages.DataView.createInLayoutGridColumnUnderWidgets(layoutGridColumn);
    dataView.name = "OrderLine_NewEdit_DataView";
    dataView.editable = true;
    dataView.showFooter = true;
    dataView.labelWidth = 0;
    dataView.widgets.push(table);
    // Create the data source for the dataview - the order entity
    const dataSource = mendixmodelsdk_1.pages.DataViewSource.createInEntityWidgetUnderDataSource(dataView);
    const entityRef = mendixmodelsdk_1.domainmodels.DirectEntityRef.createInEntityPathSourceUnderEntityRef(dataSource);
    entityRef.entity = entity;
    // Make buttons and actions for the buttons
    const saveButton = mendixmodelsdk_1.pages.ActionButton.createInDataViewUnderFooterWidgets(dataView);
    saveButton.name = "saveButton";
    saveButton.caption = createClientTemplate("Save");
    saveButton.buttonStyle = mendixmodelsdk_1.pages.ButtonStyle.Success;
    const saveClientAction = mendixmodelsdk_1.pages.SaveChangesClientAction.createInActionButtonUnderAction(saveButton);
    saveClientAction.disabledDuringExecution = true;
    saveClientAction.closePage = true;
    const cancelButton = mendixmodelsdk_1.pages.ActionButton.createInDataViewUnderFooterWidgets(dataView);
    cancelButton.name = "cancelButton";
    cancelButton.caption = createClientTemplate("Cancel");
    cancelButton.buttonStyle = mendixmodelsdk_1.pages.ButtonStyle.Default;
    const cancelClientAction = mendixmodelsdk_1.pages.CancelChangesClientAction.createInActionButtonUnderAction(cancelButton);
    cancelClientAction.disabledDuringExecution = true;
    cancelClientAction.closePage = true;
    // Make the input elements for the attributes
    createAttributeInTable(entity, "OrderLineId", "Order Line Id", table);
    createAttributeInTable(entity, "OrderLineValue", "Order Line Value", table);
    createAttributeInTable(entity, "ProductName", "Product Name", table);
    // Create the page itself
    const page = createPage(entity.containerAsDomainModel.containerAsModule, "OrderLine_NewEdit", "Edit Order Line", "Order Line");
    // Set the page parameter
    const pageParameter = mendixmodelsdk_1.pages.PageParameter.createIn(page);
    pageParameter.name = entity.name;
    const objectType = mendixmodelsdk_1.datatypes.ObjectType.createInPageParameterUnderParameterType(pageParameter);
    objectType.entity = entity;
    // Link the page to the layout
    page.layoutCall = layoutCall;
    // Link the datasource to the page parameter
    dataSource.pageParameter = pageParameter;
    // Allow access to page by both roles
    page.allowedRoles.push(adminRole);
    page.allowedRoles.push(userRole);
    return page;
}
function createEditPageForOrderEntity(entity, layout, layoutPlaceholderName, associations, orderLineEntityNewEditPage) {
    // Set up the layout for the page
    const layoutCall = createLayoutCall(layout);
    const layoutCallArgument = createLayoutArgument(layoutCall, layoutPlaceholderName);
    // Build a simple layout grid
    const layoutGrid = mendixmodelsdk_1.pages.LayoutGrid.createInLayoutCallArgumentUnderWidgets(layoutCallArgument);
    layoutGrid.name = "Order_NewEdit_LayoutGrid";
    layoutGrid.appearance = mendixmodelsdk_1.pages.Appearance.create(model);
    const layoutGridRow = mendixmodelsdk_1.pages.LayoutGridRow.createIn(layoutGrid);
    layoutGridRow.appearance = mendixmodelsdk_1.pages.Appearance.create(model);
    layoutGridRow.spacingBetweenColumns = true;
    const layoutGridColumn = mendixmodelsdk_1.pages.LayoutGridColumn.createIn(layoutGridRow);
    layoutGridColumn.weight = -1;
    layoutGridColumn.tabletWeight = -1;
    layoutGridColumn.phoneWeight = -1;
    layoutGridColumn.appearance = mendixmodelsdk_1.pages.Appearance.create(model);
    // Create a table to hold the attributes in the dataview
    const table = createTable("Order_NewEdit_Table");
    createTableColumn(table, 33);
    createTableColumn(table, 67);
    // Create the dataview and drop in the table
    const dataView = mendixmodelsdk_1.pages.DataView.createInLayoutGridColumnUnderWidgets(layoutGridColumn);
    dataView.name = "Order_NewEdit_DataView";
    dataView.editable = true;
    dataView.showFooter = true;
    dataView.labelWidth = 0;
    dataView.widgets.push(table);
    // Create the data source for the dataview - the order entity
    const dataSource = mendixmodelsdk_1.pages.DataViewSource.createInEntityWidgetUnderDataSource(dataView);
    const entityRef = mendixmodelsdk_1.domainmodels.DirectEntityRef.createInEntityPathSourceUnderEntityRef(dataSource);
    entityRef.entity = entity;
    // Make buttons and actions for the buttons
    const saveButton = mendixmodelsdk_1.pages.ActionButton.createInDataViewUnderFooterWidgets(dataView);
    saveButton.name = "saveButton";
    saveButton.caption = createClientTemplate("Save");
    saveButton.buttonStyle = mendixmodelsdk_1.pages.ButtonStyle.Success;
    const saveClientAction = mendixmodelsdk_1.pages.SaveChangesClientAction.createInActionButtonUnderAction(saveButton);
    saveClientAction.disabledDuringExecution = true;
    saveClientAction.closePage = true;
    const cancelButton = mendixmodelsdk_1.pages.ActionButton.createInDataViewUnderFooterWidgets(dataView);
    cancelButton.name = "cancelButton";
    cancelButton.caption = createClientTemplate("Cancel");
    cancelButton.buttonStyle = mendixmodelsdk_1.pages.ButtonStyle.Default;
    const cancelClientAction = mendixmodelsdk_1.pages.CancelChangesClientAction.createInActionButtonUnderAction(cancelButton);
    cancelClientAction.disabledDuringExecution = true;
    cancelClientAction.closePage = true;
    // Make the input elements for the attributes
    createAttributeInTable(entity, "OrderId", "Order Id", table);
    createAttributeInTable(entity, "OrderValue", "Order Value", table);
    createAttributeInTable(entity, "CustomerName", "Customer Name", table);
    createAttributeInTable(entity, "OrderStatus", "Order Status", table);
    // Create a file manager so the admin can upload the order document
    const fileManager1RowNumber = createTableRow(table);
    const fileManagerRow1ConditionalVisibility = mendixmodelsdk_1.pages.ConditionalVisibilitySettings.createInTableRowUnderConditionalVisibilitySettings(table.rows[fileManager1RowNumber]);
    fileManagerRow1ConditionalVisibility.moduleRoles.push(adminRole);
    const fileManager1Label = createLabel("ManagerLabel1", createText("Upload Order Document"));
    createTableCell(table, fileManager1RowNumber, 0, 1, 1, fileManager1Label);
    const fileManager1 = mendixmodelsdk_1.pages.FileManager.create(model);
    fileManager1.name = "File1";
    fileManager1.maxFileSize = 50;
    fileManager1.type = mendixmodelsdk_1.pages.FileManagerType.Both;
    createTableCell(table, fileManager1RowNumber, 1, 1, 1, fileManager1);
    // Create a file manager so the user can download the order document
    const fileManager2RowNumber = createTableRow(table);
    const fileManagerRow2ConditionalVisibility = mendixmodelsdk_1.pages.ConditionalVisibilitySettings.createInTableRowUnderConditionalVisibilitySettings(table.rows[fileManager2RowNumber]);
    fileManagerRow2ConditionalVisibility.moduleRoles.push(userRole);
    const fileManager2Label = createLabel("ManagerLabel2", createText("Download Order Document"));
    createTableCell(table, fileManager2RowNumber, 0, 1, 1, fileManager2Label);
    const fileManager2 = mendixmodelsdk_1.pages.FileManager.create(model);
    fileManager2.name = "File2";
    fileManager2.maxFileSize = 50;
    fileManager2.type = mendixmodelsdk_1.pages.FileManagerType.Download;
    createTableCell(table, fileManager2RowNumber, 1, 1, 1, fileManager2);
    // Next create a data grid to list the line items
    const association = associations.find(assoc => assoc.name = "OrderLine_Order");
    const parent = association.parent;
    const dataGrid = mendixmodelsdk_1.pages.DataGrid.create(model);
    dataGrid.name = "OrderLine_Order_DataGrid";
    var indirectEntityRef = mendixmodelsdk_1.domainmodels.IndirectEntityRef.create(model);
    var entityRefStep = mendixmodelsdk_1.domainmodels.EntityRefStep.createIn(indirectEntityRef);
    entityRefStep.association = association;
    entityRefStep.destinationEntity = parent;
    var associationSource = mendixmodelsdk_1.pages.AssociationSource.create(model);
    associationSource.entityRef = indirectEntityRef;
    //const deleteButton = createControlBarClientDeleteButton(parent);
    dataGrid.dataSource = associationSource;
    dataGrid.isControlBarVisible = true;
    dataGrid.columns.clear();
    dataGrid.columns.push(createDataGridColumn(parent, association, parent.attributes.find(att => att.name === "OrderLineId"), "Order Line Id", 50));
    dataGrid.columns.push(createDataGridColumn(parent, association, parent.attributes.find(att => att.name === "ProductName"), "Product Name", 50));
    dataGrid.numberOfRows = 5;
    const rowNumber = createTableRow(table);
    const label = createLabel(association.name + "_Label", createText(parent.name));
    createTableCell(table, rowNumber, 0, 1, 1, label);
    createTableCell(table, rowNumber, 1, 1, 1, dataGrid);
    // Create the page itself
    const page = createPage(entity.containerAsDomainModel.containerAsModule, "Order_NewEdit", "Edit Order", "Order");
    // Set the page parameter
    const pageParameter = mendixmodelsdk_1.pages.PageParameter.createIn(page);
    pageParameter.name = entity.name;
    const objectType = mendixmodelsdk_1.datatypes.ObjectType.createInPageParameterUnderParameterType(pageParameter);
    objectType.entity = entity;
    // Link the page to the layout
    page.layoutCall = layoutCall;
    // Link the datasource to the page parameter
    dataSource.pageParameter = pageParameter;
    // Create the control bar for the data grid in the page
    createDataGridControlBar(parent, orderLineEntityNewEditPage, orderLineEntityNewEditPage, dataGrid);
    // Allow access to page by both roles
    page.allowedRoles.push(adminRole);
    page.allowedRoles.push(userRole);
    return page;
}
function createOverviewPageForOrderEntity(entity, name, title, layout, layoutPlaceholderName, newPage, editPage, folderName) {
    // Create the page
    const page = createPage(entity.containerAsDomainModel.containerAsModule, name, title, folderName);
    // Set up the layout grid
    const layoutGrid = mendixmodelsdk_1.pages.LayoutGrid.create(model);
    layoutGrid.name = "Order_LayoutGrid";
    layoutGrid.appearance = mendixmodelsdk_1.pages.Appearance.create(model);
    // Row 1 gets the title and the datagrid
    const layoutGridRow1 = mendixmodelsdk_1.pages.LayoutGridRow.createIn(layoutGrid);
    layoutGridRow1.appearance = mendixmodelsdk_1.pages.Appearance.create(model);
    layoutGridRow1.spacingBetweenColumns = true;
    const layoutGridColumn1 = mendixmodelsdk_1.pages.LayoutGridColumn.createIn(layoutGridRow1);
    layoutGridColumn1.weight = -1;
    layoutGridColumn1.tabletWeight = -1;
    layoutGridColumn1.phoneWeight = -1;
    layoutGridColumn1.appearance = mendixmodelsdk_1.pages.Appearance.create(model);
    const textTitle = mendixmodelsdk_1.pages.DynamicText.createInLayoutGridColumnUnderWidgets(layoutGridColumn1);
    textTitle.name = 'Order_Title';
    textTitle.appearance = mendixmodelsdk_1.pages.Appearance.create(model);
    textTitle.content = createClientTemplate(title);
    textTitle.renderMode = mendixmodelsdk_1.pages.TextRenderMode.H2;
    // Create the data grid showing the attributes we want
    const dataGrid = mendixmodelsdk_1.pages.DataGrid.createInLayoutGridColumnUnderWidgets(layoutGridColumn1);
    dataGrid.name = "Order_DataGrid";
    dataGrid.dataSource = createDataGridDatabaseSource(entity);
    dataGrid.isControlBarVisible = true;
    dataGrid.columns.clear();
    dataGrid.columns.push(createDataGridColumn(entity, null, entity.attributes.find(att => att.name === "OrderId"), "Order Id", 20));
    dataGrid.columns.push(createDataGridColumn(entity, null, entity.attributes.find(att => att.name === "OrderValue"), "Order Value", 20));
    dataGrid.columns.push(createDataGridColumn(entity, null, entity.attributes.find(att => att.name === "CustomerName"), "Customer Name", 20));
    dataGrid.columns.push(createDataGridColumn(entity, null, entity.attributes.find(att => att.name === "OrderStatus"), "Order Status", 20));
    dataGrid.columns.push(createExtraDataGridColumn(entity, "Name", "System.FileDocument.Name", 20));
    dataGrid.numberOfRows = 10;
    // Layout grid row 2 gets the close button
    const layoutGridRow2 = mendixmodelsdk_1.pages.LayoutGridRow.createIn(layoutGrid);
    layoutGridRow2.appearance = mendixmodelsdk_1.pages.Appearance.create(model);
    layoutGridRow2.spacingBetweenColumns = true;
    const layoutGridColumn2 = mendixmodelsdk_1.pages.LayoutGridColumn.createIn(layoutGridRow2);
    layoutGridColumn2.weight = -1;
    layoutGridColumn2.tabletWeight = -1;
    layoutGridColumn2.phoneWeight = -1;
    layoutGridColumn2.appearance = mendixmodelsdk_1.pages.Appearance.create(model);
    const closePageButton = mendixmodelsdk_1.pages.ActionButton.createInLayoutGridColumnUnderWidgets(layoutGridColumn2);
    closePageButton.name = "closePageButton";
    closePageButton.action = mendixmodelsdk_1.pages.ClosePageClientAction.create(model);
    closePageButton.caption = createClientTemplate("Close Page");
    const closeButtonAppearance = mendixmodelsdk_1.pages.Appearance.createInWidgetUnderAppearance(closePageButton);
    const closeButtonDesignProperty = mendixmodelsdk_1.pages.DesignPropertyValue.createIn(closeButtonAppearance);
    closeButtonDesignProperty.key = "Spacing top";
    closeButtonDesignProperty.stringValue = "Outer medium";
    // Link to the layout
    const layoutCall = createLayoutCall(layout);
    const layoutCallArgument = createLayoutArgument(layoutCall, layoutPlaceholderName);
    layoutCallArgument.widgets.push(layoutGrid);
    page.layoutCall = layoutCall;
    // Create the controller bar
    createDataGridControlBar(entity, newPage, editPage, dataGrid);
    // Allow access to page by both roles
    page.allowedRoles.push(adminRole);
    page.allowedRoles.push(userRole);
    return page;
}
function findModuleRole(module, roleName) {
    const role = module.moduleSecurity.moduleRoles.find(role => role.name === roleName);
    if (role === undefined)
        throw new Error("Could not locate module role " + roleName + " in module");
    return role;
}
function findEntity(domainModel, entityName) {
    const entity = domainModel.entities.find(entity => entity.name === entityName);
    if (entity === undefined)
        throw new Error("Could not locate entity " + entityName + " in model");
    return entity;
}
function findAttribute(entity, attributeName) {
    const attribute = entity.attributes.find(attribute => attribute.name === attributeName);
    if (attribute === undefined)
        throw new Error("Could not locate attribute " + attributeName + " in entity " + entity.qualifiedName);
    return attribute;
}
async function findMenuItemCollection(profileName) {
    const navigation = model.allNavigationDocuments()[0];
    const profile = navigation.profiles.find(profile => profile.name === profileName);
    if (profile === undefined)
        throw new Error("Could not locate navigation profile " + profileName + " in model");
    await profile.load();
    return profile.asLoaded().menuItemCollection;
}
function addToMenuItemCollection(collection, caption, insertAtTop, page) {
    const captionText = createText(caption);
    const existingMenuItem = collection.items.find(item => (item.caption.translations.find(tr => tr.languageCode === "en_US")?.text === caption));
    if (existingMenuItem != undefined)
        existingMenuItem.delete();
    const item = mendixmodelsdk_1.menus.MenuItem.create(model);
    if (insertAtTop)
        collection.items.unshift(item);
    else
        collection.items.push(item);
    item.caption = captionText;
    const action = mendixmodelsdk_1.pages.PageClientAction.createInMenuItemUnderAction(item);
    action.pageSettings.page = page;
    return item;
}
async function deleteOldPage(pageName) {
    const pages = model.allPages().filter(page => page.qualifiedName === pageName);
    for (var row = 0; (pages) && (row < pages.length); row++) {
        const page = await pages[row].load();
        console.log("Deleting page " + page.qualifiedName);
        page.delete();
    }
}
function createLayoutArgument(layoutCall, name) {
    const result = mendixmodelsdk_1.pages.LayoutCallArgument.create(layoutCall.model);
    // Layout parameters are a derived property of a layout and this feature has not been
    // implemented in the SDK. We work around this by assigning the qualified name manually.
    result["__parameter"].updateWithRawValue(name);
    layoutCall.arguments.push(result);
    return result;
}
function createLayoutCall(layout) {
    const layoutCall = mendixmodelsdk_1.pages.LayoutCall.create(model);
    layoutCall.layout = layout;
    return layoutCall;
}
function createTable(name) {
    const table = mendixmodelsdk_1.pages.Table.create(model);
    table.name = name;
    table.cells.clear();
    table.rows.clear();
    table.columns.clear();
    return table;
}
function createTableColumn(table, width) {
    const column = mendixmodelsdk_1.pages.TableColumn.createIn(table);
    column.width = width;
    return column;
}
function createTableRow(table) {
    mendixmodelsdk_1.pages.TableRow.createIn(table);
    return table.rows.length - 1;
}
function createTableCell(table, topRowIndex, leftColumnIndex, width, height, widget) {
    const cell = mendixmodelsdk_1.pages.TableCell.createIn(table);
    cell.leftColumnIndex = leftColumnIndex;
    cell.topRowIndex = topRowIndex;
    cell.width = width;
    cell.height = height;
    cell.widgets.push(widget);
    return cell;
}
function createLabel(name, caption) {
    const label = mendixmodelsdk_1.pages.Label.create(model);
    label.name = name;
    label.caption = caption;
    return label;
}
function createAttributeInTable(entity, attributeName, title, table) {
    const attribute = findAttribute(entity, attributeName);
    const rowNumber = createTableRow(table);
    const label = createLabel(attributeName + "_Label", createText(title));
    const widget = createInputForAttribute(attribute, false);
    createTableCell(table, rowNumber, 0, 1, 1, label);
    createTableCell(table, rowNumber, 1, 1, 1, widget);
}
function createDataGridColumn(entity, association, attribute, title, width) {
    const gridColumn = mendixmodelsdk_1.pages.GridColumn.create(model);
    if (association === null)
        gridColumn.name = "column" + attribute.name + "_" + entity.name;
    else
        gridColumn.name = "column" + attribute.name + "_" + association.name;
    gridColumn.caption = createText(title);
    gridColumn.attributeRef = createAttributeRef(attribute);
    gridColumn.aggregateCaption = createText("");
    gridColumn.width = width;
    return gridColumn;
}
function createExtraDataGridColumn(entity, attributeName, qualifiedAttributeName, width) {
    const gridColumn = mendixmodelsdk_1.pages.GridColumn.create(model);
    gridColumn.name = "column" + attributeName + "_" + entity.name;
    gridColumn.caption = createText(entity.name + "_" + attributeName);
    gridColumn.attributeRef = createExtraAttributeRef(qualifiedAttributeName);
    gridColumn.aggregateCaption = createText("");
    gridColumn.width = width;
    return gridColumn;
}
function createInputForAttribute(attribute, withLabel) {
    if (attribute.type instanceof mendixmodelsdk_1.domainmodels.StringAttributeType ||
        attribute.type instanceof mendixmodelsdk_1.domainmodels.AutoNumberAttributeType ||
        attribute.type instanceof mendixmodelsdk_1.domainmodels.CurrencyAttributeType ||
        attribute.type instanceof mendixmodelsdk_1.domainmodels.DecimalAttributeType ||
        attribute.type instanceof mendixmodelsdk_1.domainmodels.FloatAttributeType ||
        attribute.type instanceof mendixmodelsdk_1.domainmodels.IntegerAttributeType ||
        attribute.type instanceof mendixmodelsdk_1.domainmodels.LongAttributeType) {
        return createTextBoxForAttribute(attribute, withLabel);
    }
    else if (attribute.type instanceof mendixmodelsdk_1.domainmodels.EnumerationAttributeType) {
        return createDropDownForAttribute(attribute, withLabel);
    }
    else if (attribute.type instanceof mendixmodelsdk_1.domainmodels.BooleanAttributeType) {
        return createCheckBoxForAttribute(attribute, withLabel);
    }
    else if (attribute.type instanceof mendixmodelsdk_1.domainmodels.DateTimeAttributeType) {
        return createDatePickerForAttribute(attribute, withLabel);
    }
    else {
        throw "Attribute type not supported: " + attribute.type;
    }
}
function createTextBoxForAttribute(attribute, withLabel) {
    const editable = attribute.type instanceof mendixmodelsdk_1.domainmodels.AutoNumberAttributeType ? mendixmodelsdk_1.pages.EditableEnum.Never : mendixmodelsdk_1.pages.EditableEnum.Always;
    return createTextBox(attribute.name + "TextBox", attribute, editable, withLabel);
}
function createTextBox(name, attribute, editable, withLabel) {
    const textBox = mendixmodelsdk_1.pages.TextBox.create(model);
    textBox.name = name;
    textBox.attributeRef = createAttributeRef(attribute);
    textBox.editable = editable;
    if (withLabel)
        textBox.labelTemplate = createClientTemplate(attribute.name);
    textBox.formattingInfo = mendixmodelsdk_1.pages.FormattingInfo.create(model);
    textBox.placeholder = createText('');
    return textBox;
}
function createDatePickerForAttribute(attribute, withLabel) {
    const datePicker = mendixmodelsdk_1.pages.DatePicker.create(model);
    datePicker.name = attribute.name + "DatePicker";
    datePicker.attributeRef = createAttributeRef(attribute);
    if (withLabel)
        datePicker.labelTemplate = createClientTemplate(attribute.name);
    datePicker.formattingInfo = mendixmodelsdk_1.pages.FormattingInfo.create(model);
    datePicker.formattingInfo.dateFormat = mendixmodelsdk_1.pages.DateFormat.DateTime;
    datePicker.placeholder = createText('');
    return datePicker;
}
function createCheckBoxForAttribute(attribute, withLabel) {
    const checkBox = mendixmodelsdk_1.pages.CheckBox.create(model);
    checkBox.name = attribute.name + "CheckBox";
    checkBox.attributeRef = createAttributeRef(attribute);
    if (withLabel)
        checkBox.labelTemplate = createClientTemplate(attribute.name);
    return checkBox;
}
function createDropDownForAttribute(attribute, withLabel) {
    const dropDown = mendixmodelsdk_1.pages.DropDown.create(model);
    dropDown.name = attribute.name + "DropDown";
    dropDown.attributeRef = createAttributeRef(attribute);
    if (withLabel)
        dropDown.labelTemplate = createClientTemplate(attribute.name);
    return dropDown;
}
function createExtraAttributeRef(qualifiedName) {
    const attributeRef = mendixmodelsdk_1.domainmodels.AttributeRef.create(model);
    attributeRef["__attribute"].updateWithRawValue(qualifiedName);
    return attributeRef;
}
function createAttributeRef(attribute) {
    const attributeRef = mendixmodelsdk_1.domainmodels.AttributeRef.create(model);
    attributeRef.attribute = attribute;
    return attributeRef;
}
function createDataGridDatabaseSource(entity) {
    const entityRef = mendixmodelsdk_1.domainmodels.DirectEntityRef.create(model);
    entityRef.entity = entity;
    const searchBar = mendixmodelsdk_1.pages.SearchBar.create(model);
    searchBar.type = mendixmodelsdk_1.pages.SearchBarTypeEnum.None;
    const source = mendixmodelsdk_1.pages.GridDatabaseSource.create(model);
    source.entityRef = entityRef;
    source.searchBar = searchBar;
    return source;
}
function createDataGridControlBar(entity, newPage, editPage, dataGrid) {
    const gridControlBar = mendixmodelsdk_1.pages.GridControlBar.createIn(dataGrid);
    const newButton = mendixmodelsdk_1.pages.GridNewButton.createIn(gridControlBar);
    newButton.name = "newButton" + entity.name;
    newButton.caption = createClientTemplate("New");
    newButton.tooltip = createText("Create and edit new object");
    newButton.entity = entity;
    const newPageSettings = mendixmodelsdk_1.pages.PageSettings.createInGridNewButtonUnderPageSettings(newButton);
    newPageSettings.page = newPage;
    const editPageSettings = mendixmodelsdk_1.pages.PageSettings.create(model);
    editPageSettings.page = editPage;
    const editPageAction = mendixmodelsdk_1.pages.PageClientAction.create(model);
    editPageAction.pageSettings = editPageSettings;
    editPageAction.disabledDuringExecution = true;
    const editButton = mendixmodelsdk_1.pages.GridActionButton.createIn(gridControlBar);
    editButton.name = "editButton" + entity.name;
    editButton.caption = createClientTemplate("Edit");
    editButton.tooltip = createText("Edit this object");
    editButton.action = editPageAction;
    const deleteButton = mendixmodelsdk_1.pages.GridActionButton.createIn(gridControlBar);
    deleteButton.name = "deleteButton" + entity.name;
    deleteButton.caption = createClientTemplate("Delete");
    deleteButton.tooltip = createText("Delete this object");
    const deletePageAction = mendixmodelsdk_1.pages.DeleteClientAction.create(model);
    deletePageAction.disabledDuringExecution = true;
    deletePageAction.closePage = false;
    deleteButton.action = deletePageAction;
    gridControlBar.defaultButton = editButton;
    return gridControlBar;
}
function createPage(module, name, title, folderName) {
    const folder = createFolderIfNotExists(module, folderName);
    const page = mendixmodelsdk_1.pages.Page.createIn(folder);
    page.name = name;
    page.title = createText(title);
    page.popupResizable = true;
    return page;
}
function createFolderIfNotExists(module, name) {
    if ((name === null) || (name === ""))
        return module;
    const existingFolder = module.folders.filter(folder => folder.name === name)[0];
    if (existingFolder != null)
        return existingFolder;
    const newFolder = mendixmodelsdk_1.projects.Folder.createIn(module);
    newFolder.name = name;
    return newFolder;
}
function createClientTemplate(text) {
    const clientTemplate = mendixmodelsdk_1.pages.ClientTemplate.create(model);
    clientTemplate.template = createText(text);
    clientTemplate.fallback = createText("");
    return clientTemplate;
}
function createText(text) {
    const newText = mendixmodelsdk_1.texts.Text.create(model);
    const existingTranslation = newText.translations.find(t => t.languageCode === 'en_US');
    if (existingTranslation) {
        existingTranslation.text = text;
    }
    else {
        const translation = createTranslation(text, 'en_US');
        newText.translations.push(translation);
    }
    return newText;
}
function createTranslation(text, languageCode) {
    const translation = mendixmodelsdk_1.texts.Translation.create(model);
    translation.text = text;
    translation.languageCode = languageCode;
    return translation;
}
function retrieveLayout(qualifiedName) {
    const layouts = model.allLayouts().filter(l => l.qualifiedName === qualifiedName);
    return layouts[0].load();
}
