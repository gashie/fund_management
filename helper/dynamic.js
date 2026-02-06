// forest.js
const GlobalModel = require("../model/Global");
const systemDate = new Date().toISOString().slice(0, 19).replace("T", " ");

// Function to add a forest
async function addItem(tableName, payload) {
  // Logic to add new record to the database
  let results = await GlobalModel.Create(payload, tableName, "");
  return results;
}

// Function to get list of items from db
async function getItems(tableName, columnsToSelect, conditions) {
  let results = await GlobalModel.Finder(
    tableName,
    columnsToSelect,
    conditions
  );
  return results;
}

async function getItemById(tableName, columnsToSelect, conditions) {
  let results = await GlobalModel.Finder(
    tableName,
    columnsToSelect,
    conditions
  );
  return results;
}

async function updateItem(payload,tableName,recordId,recordValue) {
  payload.updated_at = systemDate;

  const runupdate = await GlobalModel.Update(
    payload,
    tableName,
    recordId,
   recordValue,
  );

  return runupdate;
}

function buildMenuTree(flatMenus) {
  // Create a map to easily look up menus by their ID
  const menuMap = new Map();

  // Initialize each menu in the map and give it a 'children' property
  flatMenus.forEach(menu => {
      menuMap.set(menu.id, { ...menu, children: [] });
  });

  // Create an array to hold the root menus (menus with no parent)
  const rootMenus = [];

  flatMenus.forEach(menu => {
      if (menu.parent_menu_id) {
          // If the menu has a parent, add it to the parent's 'children' array
          const parentMenu = menuMap.get(menu.parent_menu_id);
          if (parentMenu) {
              parentMenu.children.push(menuMap.get(menu.id));
          }
      } else {
          // If the menu has no parent, it's a root menu
          rootMenus.push(menuMap.get(menu.id));
      }
  });

  return rootMenus;
}

module.exports = {
  addItem,
  getItems,
  getItemById,
  updateItem,
  buildMenuTree
};
