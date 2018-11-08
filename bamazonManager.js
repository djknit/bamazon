// Require the node modules needed for the app.
const mysql = require("mysql");
const inquirer = require("inquirer");
const columnify = require("columnify");
const chalk = require("chalk");
const dotenv = require("dotenv").config();
const moment = require("moment");

const userAuthentication = require("./userAuthentication")

// Global variables
let inventory, user, departments;
let session = {
    purchases: [],
    adjustments: [],
    replenishments: [],
    newProducts: [],
    priceChanges: [],
    specialOrders: []
}

console.log(chalk.bgBlue.yellow("\n BAMAZON MANAGER " + " ".repeat(61)));

// Configure the connection to the MySQL server and database using the 'mysql' module
const connection = mysql.createConnection({
    port: 3306,
    user: "root",
    password: process.env.MY_SQL_PASSWORD,
    database: "bamazon"
});

// Connect to the MySQL server and database.
connection.connect(error => {
    // If there was an error, print the error and stop the process.
    if (error) return console.error(error);
    // Otherwise...
    console.log("\nWelcome to " + chalk.bgBlue.yellow("BAMAZON") + " Manager View\n");
    userAuthentication.loginMenu(connection, "managers", begin, thanksBye);
});

function thanksBye() {
    console.log(chalk.magenta("\nThank you! Goodbye."));
    connection.end();
}

function begin(user0) {
    user = user0;
    return mainMenu();
}

// Generic menu function 
function userChooseAction(choices) {
    // Add "Exit" option to choices
    choices.push(["Exit", thanksBye]);
    // Parse choice arrays into choice objects.
    choices.forEach((value, index) => choices[index] = {
        name: value[0],
        value: value[1]
    });
    inquirer.prompt({
        name: "action",
        message: chalk.green("What would you like to do?"),
        type: "list",
        choices
    }).then(answer => answer.action());
}

function menu(title, choices) {
    console.log("");
    console.log(chalk.gray.underline(" " + title + "  "));
    userChooseAction(choices);
}

// MAIN MENU
const mainMenu = () => menu("MAIN MENU", [
    ["Manage inventory", inventoryMenu],
    ["Manage existing orders", ordersMenu],
    ["Create special order", createSpecialOrder]
]);

function createSpecialOrder() {

}

// INVENTORY MANAGER MENU (option function are labeled with comments beginning with '>' below)
const inventoryMenu = () => menu("Inventory Manager Menu", [
    ["View all inventory", getAndDisplayInventory],
    ["View low inventory", viewLowInventory],
    ["Add inventory", addInventory],
    ["Adjust inventory", adjustInventory],
    ["Adjust prices", adjustPrices],
    ["Back to Main Menu", mainMenu]
]);

// > "View all inventory"
function getAndDisplayInventory() {
    getDepartmentsThen(() => getInventoryThen(() => {
        displayInventory(inventory);
        inventoryMenu();
    }));
}

function getDepartmentsThen(callback) {
    connection.query("SELECT * FROM departments", (error, results) => {
        if (error) return console.error(error);
        departments = {};
        results.forEach(result => {
            departments[result.department_id.toString()] = result.department_name;
        });
        callback(results);
    });
}

function getInventoryThen(callback) {
    // Query database (using 'mysql' module) for current inventory.
    connection.query("SELECT * FROM products", (error, results) => {
        if (error) return console.error(error);
        inventory = [];
        results.forEach(value => {
            inventory.push({
                "Item ID": value.item_id,
                "Product Name": value.product_name,
                Price: value.price.toFixed(2),
                Available: value.available_quantity,
                "On Hold": value.hold_quantity,
                Reserved: value.reserved_quantity,
                Shipped: value.shipped_quantity,
                Department: departments[value.department_id.toString()]
            });
        });
        callback();
    });
}

function displayInventory(inventory) {
    // Create Columnify configuration object. Align numeric data to the right for consistent decimal alignment.
    let config = {};
    config["Item ID"] = config["Product Name"] = config.Department = { headingTransform: inventoryHeadingTransform };
    config.Price = config.Available = config["On Hold"] = config.Reserved = config.Shipped = {
        align: "right",
        headingTransform: inventoryHeadingTransform
    };
    // Print inventory to console.
    console.log((chalk.bold("\nCurrent Inventory:\n\n") + columnify(inventory, {
        config,
        // Specify 'columnify' package options.
        columnSplitter: " | ",
        // This option orders the columns.
        columns: ["Item ID", "Product Name", "Price", "Available", "On Hold", "Reserved", "Shipped", "Department"]
    }) + "\n"));
}

function inventoryHeadingTransform(heading) {
    return chalk.underline(heading);
}

// > "View low inventory"
function viewLowInventory(cutoff) {
    if (!cutoff) cutoff = 5;
    getInventoryThen(() => {
        displayInventory(inventory.filter(item => item.Available < cutoff + 1).sort((a, b) => a.Available - b.Available));
        console.log(`\nCurrently showing products with available quantity ${cutoff} or less.\n`);
        userChooseAction([
            ["Change cutoff quantity", selectCutoffQuantity],
            ["Inventory Menu", inventoryMenu],
            ["Main Menu", mainMenu]
        ]);
    });
}

function selectCutoffQuantity() {
    inquirer.prompt({
        name: "cutoff",
        message: chalk.green("Enter a quantity to show all products which have that many units or less available."),
        validate: validateNaturalNumber
    }).then(answer => viewLowInventory(parseInt(answer.cutoff)));
}

function validateNaturalNumber(answer) {
    const invalidAnswerMessage = chalk.red("Quantity must be a positive whole number.");
    if (isNaN(answer)) return invalidAnswerMessage;
    const numericAnswer = parseFloat(answer);
    if (!Number.isInteger(numericAnswer) || numericAnswer < 1) return invalidAnswerMessage;
    return true;
}

// > "Add inventory"
function addInventory() {
    userChooseAction([
        ["Replenish existing product", replenishProduct],
        ["Add new product", addProduct]
    ]);
}

function replenishProduct() {
    getInventoryThen(() => {
        console.log("");
        inquirer.prompt([{
            name: "item",
            message: chalk.green("Which item are you replenishing?"),
            type: "list",
            choices: inventory.map(item => ({
                name: `${item["Item ID"]} -- ${item["Product Name"]}`,
                value: item
            }))
        },{
            name: "quantity",
            message: chalk.green("How many units of the item are you adding?"),
            validate: validateNaturalNumber
        },{
            name: "costUnit",
            message: chalk.green("Are you entering the cost of the entire order or a single unit?"),
            type: "list",
            choices: ["Whole order", "Per unit"]
        },{
            name: "cost",
            message: chalk.green("Enter the cost (in dollars)."),
            validate: (answer) => {
                const invalidAnswerMessage = chalk.red("You must enter a valid dollar amount.");
                if (isNaN(answer)) return invalidAnswerMessage;
                const numericAnswer = parseFloat(answer);
                if ((!Number.isInteger(numericAnswer) && answer.split(".")[1].length > 2) || numericAnswer < 0) return invalidAnswerMessage;
                return true;
            }
        }]).then(answers => {
            const item = answers.item;
            const quantity = parseInt(answers.quantity);
            let orderCost = answers.costUnit === "Whole order" ? parseFloat(answers.cost).toFixed(2) : (quantity * parseFloat(answers.cost)).toFixed(2);
            item.unitCost = answers.costUnit === "Whole order" ? (parseFloat(answers.cost) / quantity).toFixed(2) : parseFloat(answers.cost).toFixed(2);
            console.log(`\nAdding ${chalk.bold(answers.quantity)} units of "${answers.item["Product Name"]}"`);
            console.log(`  Unit cost: $${chalk.bold(item.unitCost)}\n Total cost: $${chalk.bold(orderCost)}`);
            console.log("\nPlease verify that this information is correct before continuing.\n")
            inquirer.prompt({
                name: "confirm",
                type: "confirm",
                message: "Confirm add inventory?"
            }).then(answer => answer.confirm ? updateItemThen(completeAddInventory, item, quantity) : editAddInventory());
        });
    });
}

function addProduct() {
    getDepartmentsThen((results) => {
        console.log("Enter the full name of the new product.\nThis is how the product will appear to customers.");
        console.log("Include any important specifications such as the size of the product.\n");
        inquirer.prompt([{
            name: "name",
            message: chalk.green("What is the product name?")
        },{
            name: "department",
            message: chalk.green("Which department does the product belong to?"),
            type: "list",
            choices: results.map(obj => ({
                name: `${obj.department_id} -- ${obj.department_name}`,
                value: obj
            }))
        },{
            name: "price",
            message: "What is the retail price of the item?",
            validate: (answer) => {
                const invalidAnswerMessage = chalk.red("You must enter a valid dollar amount.");
                if (isNaN(answer)) return invalidAnswerMessage;
                const numericAnswer = parseFloat(answer);
                if ((!Number.isInteger(numericAnswer) && answer.split(".")[1].length > 2) || numericAnswer < 0) return invalidAnswerMessage;
                return true;
            }
        }]).then(answers => {
            const newProduct = answers;
            console.log("\nPlease carefully review the product information.")
            console.log(`\nProduct name: "${chalk.bold(answers.name)}"\n\nDepartment: ${chalk.bold(answers.department.department_name)}\n`);
            inquirer.prompt({
                name: "verify",
                type: "confirm",
                message: "Is the product information correct and ready to be added to the database?"
            }).then(answer => answer.verify ? completeAddProduct(newProduct) : editAddInventory());
        });
    });
}

function completeAddProduct(newProduct) {
    // connection.query("INSERT INTO products SET ?",
    //     {
    //         product_name: newProduct.name,
    //         department_name: 
    //     }
    // )
}

function updateItemThen(callback, item, quantity) {
    connection.query("SELECT available_quantity FROM products WHERE ?",
        { item_id: item["Item ID"] },
        function(error, results) {
            if (error) return console.error(error);
            item.Available = results[0].available_quantity;
            callback(item, quantity);
        }
    );
}

function editAddInventory() {
    console.log(chalk.bold("\nThe product was NOT added to the inventory.\n"))
    userChooseAction([
        ["Replenish existing product", addInventory],
        ["Add a new product", addProduct]
        ["Inventory Menu", inventoryMenu],
        ["Main Menu", mainMenu]
    ]);
}

function completeAddInventory(item, quantityToAdd) {
    item.Available += quantityToAdd;
    const unitCost = parseFloat(item.unitCost);
    // Update item 'available_quantity' in database
    connection.query("UPDATE products set ? WHERE ?",
        [{ available_quantity: item.Available, cost: unitCost }, { item_id: item["Item ID"] }],
        (error, results) => {
            if (error) return console.error(error);
            const purchase = {
                item_id: item["Item ID"],
                quantity: quantityToAdd,
                unit_cost: unitCost,
                purchase_time: moment().format("MM-DD-YY, hh:mm a"),
                manager_id: user.userId
            }
            // Add purchase to 'purchases' table in database
            connection.query("INSERT INTO purchases SET ?", purchase, (error, results) => {
                if (error) return console.error(error);
                session.purchases.push(results.insertId);
                console.log(purchaseInfoString(purchase, item, results.insertId));
                userChooseAction([
                    ["Replenish another product", addInventory],
                    ["Inventory Menu", inventoryMenu],
                    ["Main Menu", mainMenu]
                ]);
            });
        }
    );
}

function purchaseInfoString(purchase, item, purchaseId) {
    const headAndFoot = chalk.yellow.underline.strikethrough("_ ".repeat(40)) + "\n";
    return chalk.yellow(headAndFoot + chalk.bold("\n  INVENTORY ADDED") + " ".repeat(42) +
` ${purchase.purchase_time}

${chalk.bold(purchase.quantity)} units of "${item["Product Name"]}"

   @ $${chalk.bold((purchase.unit_cost).toFixed(2))}/unit

  Total cost: $ ${chalk.bold((purchase.unit_cost * purchase.quantity).toFixed(2))}` + " ".repeat(35) + `[Purchase ID = ${purchaseId}]

` + headAndFoot + "\n");
}

// > "Adjust inventory"
function adjustInventory() {

}

// > "Adjust prices"
function adjustPrices() {

}

// ORDERS MANAGER MENU
const ordersMenu = () => menu("Orders Manager Menu",
    [
        ["View orders", viewOrders],
        ["Search orders", searchOrders],
        ["Enter payments", enterPayments],
        ["Enter shipments", enterShipments],
        ["Back to Main Menu", mainMenu]
    ]
);

function viewOrders() {

}

function searchOrders() {

}

function enterPayments() {

}

function enterShipments() {

}