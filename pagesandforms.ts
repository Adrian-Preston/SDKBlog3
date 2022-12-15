import { MendixPlatformClient } from "mendixplatformsdk";
import { IModel, pages, projects, domainmodels, enumerations, texts } from 'mendixmodelsdk';

var model: IModel;

main().catch(console.error);


async function main()
{
    const client = new MendixPlatformClient();

    // Open the app
    const app = client.getApp("27084efc-8f89-4019-98e3-1b9bbc4d9257");

    // Open a working copy
    const workingCopy = await app.createTemporaryWorkingCopy("trunk");

    // Store the model globally as it's used everywhere...
    model = await workingCopy.openModel();

    // Find the module we want to change and error if not found
    const module = model.allModules().filter(module => module.name === "SDKModule")[0];

    if (module === null)
    {
        console.log("Could not locate module SDKModule in the specified app");
        return;
    }

    const domainModel = module.domainModel.asLoaded();

    const desktopLayout = await retrieveLayout("Atlas_Core.Atlas_TopBar");
	const desktopLayoutPlaceholder = "Atlas_Core.Atlas_TopBar.Main";
	const popupLayout = await retrieveLayout("Atlas_Core.PopupLayout");
	const popupLayoutPlaceholder = "Atlas_Core.PopupLayout.Main";

    // Create Overview page for Order Entity
    const orderEntity = findEntity(domainModel, "Order");
    if (orderEntity === null)
        return;

    const orderEntityDatagridSource = createDataGridDatabaseSource(orderEntity);;

	const orderEntityOverviewDeleteButton = createControllerBarClientDeleteButton(orderEntity);

	const orderEntityOverviewPage = createGridPageForEntity(orderEntity, "Order_Overview", "Order Overview", desktopLayout, desktopLayoutPlaceholder, NewEdit$Category_NewEdit, NewEdit$Category_NewEdit, OA$Over$Category_Overview, "", DSOver$Category_Overview, DELOver$Category_Overview, "Category");



}


function findEntity(domainModel: domainmodels.DomainModel, name: string): domainmodels.Entity | null
{
    const orderEntity = domainModel.entities.find(entity => entity.name === name);

    if (orderEntity === undefined)
    {
        console.log("Could not locate OrderEntity in model");
        return null;
    }

    return orderEntity;
}

function createGridPageForEntity(entity: domainmodels.Entity, name: string, title: string, layout: pages.Layout, layoutPlaceholderName: string,
    newPage: pages.Page, editPage: pages.Page, overviewAttributes: domainmodels.Attribute[], generalization: string, dataSource: pages.DataSource,
    deleteActionButton: pages.GridActionButton, folderName: string): pages.Page
{

    const page = createPage(entity.containerAsDomainModel.containerAsModule, name, title, folderName);

    const dataGrid = this.createDataGridForEntity(entity, overviewAttributes, generalization, dataSource);

    const textTitle = pages.DynamicText.create(model);
    textTitle.name = name + '_Title';;
    textTitle.appearance = pages.Appearance.create(model);
    textTitle.content = createClientTemplate(title);
    textTitle.renderMode = pages.TextRenderMode.H2;

    const layoutGridColumn1 = pages.LayoutGridColumn.create(model);
    layoutGridColumn1.weight = -1;
    layoutGridColumn1.tabletWeight = -1;
    layoutGridColumn1.phoneWeight = -1;
    layoutGridColumn1.widgets.push(textTitle);
    layoutGridColumn1.widgets.push(dataGrid);
    layoutGridColumn1.appearance = pages.Appearance.create(model);

    const layoutGridRow1 = pages.LayoutGridRow.create(model);
    layoutGridRow1.columns.push(layoutGridColumn1);
    layoutGridRow1.appearance = pages.Appearance.create(model);
    layoutGridRow1.spacingBetweenColumns = true;

    const closeButtonDesignProperty = pages.DesignPropertyValue.create(model);
    closeButtonDesignProperty.key = "Spacing top";
    closeButtonDesignProperty.stringValue = "Outer medium";

    const closeButtonAppearance = pages.Appearance.create(model);
    closeButtonAppearance.designProperties.push(closeButtonDesignProperty);

    const closePageAction = pages.ClosePageClientAction.create(model);
    const closePageButton = pages.ActionButton.create(model);
    closePageButton.name = "closePageButton";
    closePageButton.action = closePageAction;
    closePageButton.caption = createClientTemplate("Close Page");
    closePageButton.appearance = closeButtonAppearance;
    
    const layoutGridColumn2 = pages.LayoutGridColumn.create(model);
    layoutGridColumn2.weight = -1;
    layoutGridColumn2.tabletWeight = -1;
    layoutGridColumn2.phoneWeight = -1;
    layoutGridColumn2.widgets.push(closePageButton);
    layoutGridColumn2.appearance = pages.Appearance.create(model);

    const layoutGridRow2 = pages.LayoutGridRow.create(model);
    layoutGridRow2.columns.push(layoutGridColumn2);
    layoutGridRow2.appearance = pages.Appearance.create(model);
    layoutGridRow2.spacingBetweenColumns = true;

    const layoutGrid = pages.LayoutGrid.create(model);
    layoutGrid.name = entity.name + "_LayoutGrid";
    layoutGrid.appearance = pages.Appearance.create(model);
    layoutGrid.rows.push(layoutGridRow1);
    layoutGrid.rows.push(layoutGridRow2);

    const layoutCall = this.createLayoutCall(layout);
    const layoutCallArgument = this.createLayoutArgument(layoutCall, layoutPlaceholderName);

    layoutCallArgument.widgets.push(layoutGrid);

    page.layoutCall = layoutCall;

    this.createDataGridControllerBar(entity, newPage, editPage, dataGrid, deleteActionButton);

    return page;
}


function createDataGridDatabaseSource(entity: domainmodels.Entity): pages.GridDatabaseSource
{
    const entityRef = domainmodels.DirectEntityRef.create(model);
    entityRef.entity = entity;

    const searchBar = pages.SearchBar.create(model);
    searchBar.type = pages.SearchBarTypeEnum.None;

    const source = pages.GridDatabaseSource.create(model);
    source.entityRef = entityRef;
    source.searchBar = searchBar;

    return source;
}

function createDataGridForEntity(entity: domainmodels.Entity, overviewAttributes: domainmodels.Attribute[],
    generalization: string, dataSource: pages.DataSource): pages.DataGrid
{
    const grid = pages.DataGrid.create(model);
    grid.name = entity.name + "_DataGrid";
    grid.dataSource = dataSource;
    grid.isControlBarVisible = true;
    grid.columns.clear();

    if ((overviewAttributes === undefined) || (overviewAttributes.length < 1))
        overviewAttributes = entity.attributes;

    let width = Math.floor(100 / overviewAttributes.length);
    if (generalization === "System.FileDocument")
        width = Math.floor(100 / (overviewAttributes.length + 2));

    for (var row = 0; (overviewAttributes) && (row < overviewAttributes.length); row++)
    {
        const column = this.createDataGridColumn(entity, null, overviewAttributes[row], width);
        grid.columns.push(column);
    }

    if (generalization === "System.FileDocument")
    {
        const nameColumn =  this.createExtraDataGridColumn(entity, "Name", "System.FileDocument.Name", width);
        grid.columns.push(nameColumn);
        const sizeColumn =  this.createExtraDataGridColumn(entity, "Size", "System.FileDocument.Size", width);
        grid.columns.push(sizeColumn);
    }
    
    grid.numberOfRows = 10;
    return grid;
}


function createControllerBarClientDeleteButton(entity: domainmodels.Entity): pages.GridActionButton
{
    const deleteButton = pages.GridActionButton.create(model);
    deleteButton.name = "deleteButton" + entity.name;
    deleteButton.caption = createClientTemplate("Delete");
    deleteButton.tooltip = createText("Delete this object");

    const deletePageAction = pages.DeleteClientAction.create(model);
    deletePageAction.disabledDuringExecution = true;
    deletePageAction.closePage = false;

    deleteButton.action = deletePageAction;
    return deleteButton;
}

function createPage(module: projects.Module, name: string, title: string, folderName: string): pages.Page
{
    const folder = createFolderIfNotExists(module, folderName);
    const page = pages.Page.createIn(folder);

    page.name = name;
    page.title = createText(title);
    page.popupResizable = true;

    return page;
}

function createFolderIfNotExists(module: projects.Module, name: string): projects.IFolder
{
    if ((name === null) || (name === ""))
        return module;

    const existingFolder = module.folders.filter(folder => folder.name === name)[0];

    if (existingFolder != null)
    {
        return existingFolder;
    }

    const newFolder = projects.Folder.createIn(module);
    newFolder.name = name;
    return newFolder;
}


function createClientTemplate(text: string): pages.ClientTemplate
{
    const clientTemplate = pages.ClientTemplate.create(model);
    clientTemplate.template = createText(text);
    clientTemplate.fallback = createText("");

    return clientTemplate;
}

function createText(text: string): texts.Text
{
    const newText = texts.Text.create(model);

    const existingTranslation = newText.translations.find(t => t.languageCode === 'en_US');
    
    if (existingTranslation) {
        existingTranslation.text = text;
    } else {
        const translation = createTranslation(text, 'en_US');
        newText.translations.push(translation);
    }

    return newText;
}

function createTranslation(text: string, languageCode: string): texts.Translation
{
    const translation = texts.Translation.create(model);
    translation.text = text;
    translation.languageCode = languageCode;
    return translation;
}

function retrieveLayout(qualifiedName: string): Promise<pages.Layout>
{
    const layouts = model.allLayouts().filter(l => l.qualifiedName === qualifiedName);

    return layouts[0].load();
}


