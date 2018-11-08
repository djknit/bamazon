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
    ["Manage existing orders", ordersMenu] //,
    // ["Create special order", createSpecialOrder]
]);

// function createSpecialOrder() {

// }

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
    getInventoryThen(() => {
        displayInventory(inventory);
        inventoryMenu();
    });
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
    getDepartmentsThen(() => {
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
                    Department: departments[value.department_id.toString()],
                    Cost: value.cost ? value.cost.toFixed(2) : null
                });
            });
            callback();
        });
    });
}

function displayInventory(inventory) {
    // Create Columnify configuration object. Align numeric data to the right for consistent decimal alignment.
    let config = {};
    config["Item ID"] = config["Product Name"] = config.Department = { headingTransform: (heading) => chalk.underline(heading) };
    config.Price = config.Cost = config.Available = config["On Hold"] = config.Reserved = config.Shipped = {
        align: "right",
        headingTransform: (heading) => chalk.underline(heading)
    };
    // Print inventory to console.
    console.log((chalk.bold("\nCurrent Inventory:\n\n") + columnify(inventory, {
        config,
        // Specify 'columnify' package options.
        columnSplitter: " | ",
        // This option orders the columns.
        columns: ["Item ID", "Product Name", "Price", "Cost", "Available", "On Hold", "Reserved", "Shipped", "Department"]
    }) + "\n"));
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

// > > "Replenish existing product"
function replenishProduct(item_id) {
    if (item_id) {
        return enterPurchaseInformation(inventory.filter(item => item["Item ID"] === item_id));
    }
    selectItemThen(enterPurchaseInformation, "Which item are you replenishing?");
}

function selectItemThen(callback, message) {
    getInventoryThen(() => {
        let choices = inventory.map(item => ({
            name: `${item["Item ID"]} -- ${item["Product Name"]}`,
            value: item
        }));
        choices.push({ name: "CANCEL", value: false });
        console.log("");
        inquirer.prompt({
            name: "item",
            message: chalk.green(message),
            type: "list",
            choices
        }).then(answer => !answer.item ? mainMenu() : callback(answer.item));
    });
}

function enterPurchaseInformation(item) {
    console.log("");
    inquirer.prompt([{
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
        validate: validateDollarAmount
    }]).then(answers => {
        const quantity = parseInt(answers.quantity);
        let orderCost = answers.costUnit === "Whole order" ? parseFloat(answers.cost).toFixed(2) : (quantity * parseFloat(answers.cost)).toFixed(2);
        item.unitCost = answers.costUnit === "Whole order" ? (parseFloat(answers.cost) / quantity).toFixed(2) : parseFloat(answers.cost).toFixed(2);
        console.log(chalk.cyan(`\nAdding ${chalk.bold(answers.quantity)} units of "${item["Product Name"]}"`));
        console.log(chalk.cyan(`  Unit cost: $${chalk.bold(item.unitCost)}\n Total cost: $${chalk.bold(orderCost)}`));
        console.log("\nPlease verify that this information is correct before continuing.\n")
        inquirer.prompt({
            name: "confirm",
            type: "confirm",
            message: chalk.green("Confirm add inventory?")
        }).then(answer => answer.confirm ? updateItemThen(completeAddInventory, item, quantity) : editAddInventory());
    });
}

const validateDollarAmount = (answer) => {
    const invalidAnswerMessage = chalk.red("You must enter a valid dollar amount.");
    if (isNaN(answer)) return invalidAnswerMessage;
    const numericAnswer = parseFloat(answer);
    if ((!Number.isInteger(numericAnswer) && answer.split(".")[1].length > 2) || numericAnswer < 0) return invalidAnswerMessage;
    return true;
};

function updateItemThen(callback, item, quantity) {
    connection.query("SELECT * FROM products WHERE ?",
        { item_id: item["Item ID"] },
        function(error, results) {
            if (error) return console.error(error);
            item["Item ID"] = results[0].item_id;
            item["Product Name"] = results[0].product_name;
            item.Price = results[0].price.toFixed(2);
            item.Available = results[0].available_quantity;
            item["On Hold"] = results[0].hold_quantity;
            item.Reserved = results[0].reserved_quantity;
            item.Shipped = results[0].shipped_quantity;
            item.Department = departments[results[0].department_id.toString()];
            if (results[0].cost) item.Cost = results[0].cost.toFixed(2);
            callback(item, quantity);
        }
    );
}

function editAddInventory() {
    console.log(chalk.bold("\nThe product was NOT added to the inventory.\n"))
    userChooseAction([
        ["Replenish existing product", addInventory],
        ["Add a new product", addProduct],
        ["Inventory Menu", inventoryMenu],
        ["Main Menu", mainMenu]
    ]);
}

function completeAddInventory(item, quantityToAdd) {
    item.Available += quantityToAdd;
    const unitCost = parseFloat(item.unitCost);
    // Update item 'available_quantity' in database
    connection.query("UPDATE products SET ? WHERE ?",
        [{ available_quantity: item.Available, cost: unitCost }, { item_id: item["Item ID"] }],
        (error) => {
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

// > > "Add new product"
function addProduct() {
    getDepartmentsThen((results) => {
        console.log("\nEnter the full name of the new product.\nThis is how the product will appear to customers.");
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
            message: chalk.green("What is the retail price of the item?"),
            validate: validateDollarAmount
        }]).then(answers => {
            const newProduct = answers;
            newProduct.price = parseFloat(newProduct.price).toFixed(2);
            console.log(chalk.bold("\nPlease carefully review the product information."))
            console.log(chalk.cyan(`\nProduct name: "${chalk.bold(answers.name)}"\n\nDepartment: ${chalk.bold(answers.department.department_name)}`));
            console.log(chalk.cyan(`\nRetail price: $${chalk.bold(answers.price)}\n`));
            inquirer.prompt({
                name: "verify",
                type: "confirm",
                message: chalk.green("Is the product information correct and ready to be added to the database?")
            }).then(answer => answer.verify ? completeAddProduct(newProduct) : editAddInventory());
        });
    });
}

function completeAddProduct(newProduct) {
    connection.query("INSERT INTO products SET ?",
        {
            product_name: newProduct.name,
            department_id: newProduct.department.department_id,
            price: parseFloat(newProduct.price),
            available_quantity: 0
        }, (error, results) => {
            if (error) return console.error(error);
            newProduct.item_id = results.insertId;
            session.newProducts.push(results.insertId);
            console.log(chalk.yellow(`\n${chalk.bold("NEW PRODUCT ADDED")}           to ${newProduct.department.department_name} department`));
            console.log(chalk.yellow(`\n  Name: "${chalk.bold(newProduct.name)}"`));
            console.log(chalk.yellow(`  Retail price: $${chalk.bold(newProduct.price)}\n`));
            userChooseAction([
                [`Add inventory for newly added product "${newProduct.name}"`, () => replenishProduct(newProduct.item_id)],
                ["Add another new product", addProduct],
                ["Inventory Menu", inventoryMenu],
                ["Main Menu", mainMenu]
            ]);
        }
    );
}

// > "Adjust inventory"
function adjustInventory() {
    selectItemThen((item) => {
        inquirer.prompt({
            name: "reason",
            message: chalk.green("Select reason for this inventory adjustment."),
            type: "list",
            choices: [
                { name: "Damaged inventory", value: "damaged"},
                { name: "Lost inventory", value: "lost" },
                { name: "Found inventory", value: "found"},
                { name: "Donation", value: "donated" }
            ]
        }).then(answer => {
            const adjustmentReason = answer.reason;
            inquirer.prompt({
                name: "quantity",
                message: chalk.green(`How many units of ${item["Product Name"]} were ${adjustmentReason}?`),
                validate: validateNaturalNumber
            }).then(answer => {
                const adjustmentQuantity = parseInt(answer.quantity);
                const operation = adjustmentReason === "found" ? "added to" : "removed from";
                console.log(chalk.cyan(`\nAdjusting inventory for "${chalk.bold(item["Product Name"])}"`));
                console.log(chalk.cyan(`\n  Reason: ${chalk.bold(adjustmentReason.toUpperCase())}`));
                console.log(chalk.cyan(`\n  ${chalk.bold(adjustmentQuantity)} units are being ${chalk.bold(operation)} to the inventory.`));
                console.log("\nPlease verify that this information is correct before continuing.\n");
                inquirer.prompt({
                    name: "verify",
                    message: chalk.green("Submit adjustment?"),
                    type: "confirm"
                }).then(answer => answer.verify ? completeAdjustInventory(item, adjustmentReason, adjustmentQuantity) : editAdjustInventory());
            });
        });
    }, "Which product are you adjusting the inventory of?");
}

function editAdjustInventory() {
    console.log(chalk.bold("\nThe inventory was NOT adjusted.\n"))
    userChooseAction([
        ["Inventory adjustment", adjustInventory],
        ["Inventory Menu", inventoryMenu],
        ["Main Menu", mainMenu]
    ]);
}

function completeAdjustInventory(item, reason, quantity) {
    updateItemThen((item, quantity) => {
        if (reason !== "found") quantity = 0 - quantity;
        item.Available += quantity;
        connection.query("UPDATE products SET ? WHERE ?", [
            { available_quantity: item.Available },
            { item_id: item["Item ID"] }
        ], error => {
            if (error) return console.error(error);
            let adjustment = {
                item_id: item["Item ID"],
                quantity_added: quantity,
                reason,
                adjustment_time: moment().format("MM-DD-YY, hh:mm a"),
                manager_id: user.userId
            };
            connection.query("INSERT INTO adjustments SET ?", adjustment, (error, results) => {
                if (error) return console.error(error);
                session.adjustments.push(results.insertId);
                adjustment.adjustment_id = results.insertId;
                console.log(inventoryAdjustmentInfoString(item, adjustment));
                userChooseAction([
                    ["Inventory adjustment", adjustInventory],
                    ["Inventory Menu", inventoryMenu],
                    ["Main Menu", mainMenu]
                ]);
            });
        });
    }, item, quantity);
}

function inventoryAdjustmentInfoString(item, adjustment) {
    const headAndFoot = chalk.yellow.underline.strikethrough("_ ".repeat(40)) + "\n";
    return chalk.yellow(headAndFoot + chalk.bold("\n  INVENTORY ADJUSTMENT COMPLETED") + " ".repeat(27) +
` ${adjustment.adjustment_time}

${chalk.bold(adjustment.quantity_added)} units of "${item["Product Name"]}" added to inventory.

   Reason: ${chalk.bold(adjustment.reason.toUpperCase() + " INVENTORY")}             [ Adjustment ID = ${adjustment.adjustment_id} ]

` + headAndFoot + "\n");
}

// > "Adjust prices"
function adjustPrices() {
    selectItemThen((item) => {
        console.log("The current price of the selected item is $" + item.Price + ".\n");
        inquirer.prompt({
            name: "price",
            message: "Enter the new sale price for the item.",
            validate: validateDollarAmount
        }).then(answer => {
            const newPrice = parseFloat(answer.price).toFixed(2);
            console.log(chalk.cyan(`\nChanging the price of ${item["Product Name"]} from $${item.Price} to ${newPrice}.`));
            console.log("\nPlease verify that this information is correct before continuing.\n");
            inquirer.prompt({
                name: "verify",
                message: chalk.green("Submit price change?"),
                type: "confirm"
            }).then(answer => answer.verify ? completePriceChange(item, newPrice) : editAdjustPrices());

        });
    }, "Which item would you like to edit the price of?");
}
function completePriceChange(item, newPrice) {
    updateItemThen((item) => {
        const oldPrice = item.Price;
        item.Price = newPrice;
        connection.query("UPDATE products SET ? WHERE ?", [
            { price: item.Price },
            { item_id: item["Item ID"] }
        ], error => {
            if (error) return console.error(error);
            let price_change = {
                item_id: item["Item ID"],
                old_price: oldPrice,
                new_price: newPrice,
                change_time: moment().format("MM-DD-YY, hh:mm a"),
                manager_id: user.userId
            };
            connection.query("INSERT INTO price_changes SET ?", price_change, (error, results) => {
                if (error) return console.error(error);
                session.priceChanges.push(results.insertId);
                price_change.change_id = results.insertId;
                console.log(chalk.yellow.bold("\nPRICE CHANGE COMPLETE\n"));
                console.log(chalk.yellow(`The unit sale price of ${item["Product Name"]}\nwas changed from $${chalk.bold(oldPrice)} to $${chalk.bold(newPrice)}.\n`));
                userChooseAction([
                    ["Adjust prices", adjustPrices],
                    ["Inventory Menu", inventoryMenu],
                    ["Main Menu", mainMenu]
                ]);
            });
        });
    }, item);
}

function editAdjustPrices() {
    console.log(chalk.bold("\nThe inventory was NOT adjusted.\n"))
    userChooseAction([
        ["Inventory adjustment", adjustInventory],
        ["Inventory Menu", inventoryMenu],
        ["Main Menu", mainMenu]
    ]);
}


// ORDERS MANAGER MENU
const ordersMenu = () => menu("Orders Manager Menu", [
    ["View orders", viewOrders],
    ["Search orders", searchOrders],
    ["Enter payments", enterPayments],
    ["Enter shipments", enterShipments],
    ["Back to Main Menu", mainMenu]
]);

function viewOrders() {
    getOrdersThen(displayOrders);
}

function getOrdersThen(callback) {
    getInventoryThen(() => {
        connection.query("SELECT * FROM orders", (error, results) => {
            if (error) return console.error(error);
            let orders = [];
            results.forEach(order => {
                const product = inventory.filter(product => product["Item ID"] === order.item_id)[0];
                orders.push({
                    "Order ID": order.order_id,
                    "Customer ID": order.customer_id,
                    Product: product["Product Name"],
                    Quantity: order.quantity,
                    Total: order.order_price.toFixed(2),
                    "Time Ordered": order.order_time,
                    Paid: order.paid === "0" ? "Not Paid" : order.paid,
                    Shipped: order.shipped === "0" ? "Not Shipped" : order.shipped,
                    item: product
                });
            });
            callback(orders);
        });
    });
}

function displayOrders(orders) {
    if (orders.length < 1) return console.log("\nThere are no orders that match that criteria.\n");
    let config = {};
    config["Order ID"] = config["Customer ID"] = config.Product = config["Time Ordered"] = config.Paid = config.Shipped = { headingTransform: (heading) => chalk.underline(heading) };
    config.Quantity = config.Total = { align: "right", headingTransform: (heading) => chalk.underline(heading) };
    console.log("\n" + columnify(orders, {
        // Specify 'columnify' package options.
        columnSplitter: " | ",
        // This option orders the columns.
        columns: ["Order ID", "Product", "Quantity", "Total", "Time Ordered", "Paid", "Shipped"],
        // Align numeric data to the right for consistent decimal alignment
        config
    }) + "\n");
}

// function searchOrders() {

// }

function enterPayments() {
    getOrdersThen(orders => {
        let choices = [];
        orders.forEach(order => choices.push({
            name: `Order #${order["Order ID"]}: Customer #${order["Customer ID"]}, Total = $${order.Total}, Ordered ${order["Time Ordered"]}`,
            value: order
        }));
        inquirer.prompt({
            name: "order",
            message: chalk.green("Choose an order to mark as paid."),
            choices
        }).then(answer => {
            console.log(chalk.cyan(`\nMarking Order #${answer.order} as paid.`));
            inquirer.prompt({
                name: "verify",
                message: chalk.green("Finish marking order paid?"),
                type: "confirm"
            }).then(answer => answer.verify ? markPaid(order) : ordersMenu());
        });
    });
}

// function markPaid(order) {
//     updateItemThen(() => {

//         connection.query("UPDATE products SET ? WHERE ?", [
//             { hold_quantity: }])
//     }, order.item, order.Quantity);
    
// }

// function enterShipments() {

// }