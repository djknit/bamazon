// Require the node modules needed for the app.
const mysql = require("mysql");
const inquirer = require("inquirer");
const chalk = require("chalk");

const BAMAZON = chalk.bgBlue.yellow("Bamazon");

function userSelectFirstAction(connection, table, begin, thanksBye) {
    inquirer.prompt({
        name: "action",
        message: chalk.green("What would you like to do?"),
        type: "list",
        choices: ["Sign in", "Create a new account", "Exit"]
    }).then(answer => {
        if (answer.action === "Sign in") return login(connection, table, begin, thanksBye);
        if (answer.action == "Create a new account") return createAccount(connection, table, begin, thanksBye);
        thanksBye();
    });
}

function login(connection, table, begin, thanksBye) {
    console.log("");
    inquirer.prompt([{
        name: "username",
        message: chalk.green("Enter your user name:"),
        validate: answer => answer.trim() === "" ? chalk.red("Username can't be empty.") : true
    },{
        name: "password",
        type: "password",
        message: chalk.green("Enter your password")
    }]).then(answers => {
        connection.query(`SELECT * FROM ${table} WHERE username = ? AND user_password = ?`, [answers.username, answers.password], (error, results) => {
            if (error) return console.error(error);
            if (results.length < 1) {
                console.log(chalk.red("Sorry that user name and password don't match our records."));
                loginTryAgain(connection, table, begin, thanksBye);
            }
            else {
                const user = {
                    username: results[0].username,
                    userId: (table === "customers") ? results[0].customer_id : results[0].manager_id
                };
                console.log(chalk.magenta("\nWelcome back " + chalk.bold(user.username) + "!"));
                begin(user);
            }
        });
    });
}

function createAccount(connection, table, begin, thanksBye) {
    console.log("");
    inquirer.prompt({
        name: "username",
        message: chalk.green("Enter user name:"),
        validate: answer => answer.trim() === "" ? chalk.red("Username can't be empty.") : true
    }).then((answer) => {
        connection.query(`SELECT * FROM ${table} WHERE username = ?`, answer.username, (error, results) => {
            if (error) return console.error(error);
            if (results.length > 0) {
                console.log(chalk.red("Sorry, that user name is already taken."));
                loginTryAgain(connection, table, begin, thanksBye);
            }
            else {
                userSetPassword(answer.username, connection, table, begin, thanksBye);
            }
        });
    });
}

function loginTryAgain(connection, table, begin, thanksBye) {
    console.log("");
    inquirer.prompt({
        name: "continue",
        message: chalk.green("What would you like to do?"),
        type: "list",
        choices: ["Sign in with existing account", "Create a new account", "Exit"]
    }).then(answer => {
        if (answer.continue === "Sign in with existing account") return login(connection, table, begin, thanksBye);
        if (answer.continue === "Create a new account") return createAccount(connection, table, begin, thanksBye);
        thanksBye();
    });
}

function userSetPassword(username, connection, table, begin) {
    inquirer.prompt([{
        name: "password",
        type: "password",
        message: chalk.green("Enter password:")
    },{
        name: "confirm",
        type: "password",
        message: chalk.green("Confirm password:")
    }]).then(answers => {
        if (answers.password !== answers.confirm) {
            console.log(chalk.red("The passwords you entered didn't match.") + "\nPlease try again.");
            userSetPassword();
        }
        else {
            connection.query(`INSERT INTO ${table} SET ?`,
                {
                    username,
                    user_password: answers.password
                },
                (error, results) => {
                    if (error) return console.error(error);
                    console.log(chalk.magenta(`\nWelcome to ${BAMAZON}, ` + chalk.bold(username) + "!"));
                    console.log({
                        username,
                        userId: results.insertId
                    });
                    begin({
                        username,
                        userId: results.insertId
                    });
                }
            );
        }
    });
}

module.exports = {
    loginMenu: userSelectFirstAction
}