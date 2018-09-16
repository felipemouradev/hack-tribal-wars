const puppeteer = require('puppeteer');
const Promise = require("bluebird");
const fs = require('fs');

const login = process.env.LOGIN;
const password = process.env.PASSWORD;

const settings = {
    headless: true,
    world: "w4",
    isUpdateBuildings: true,
    isUpdateBarracksUnit: false,
    isUpdateStableUnits: false,
    defaultNumberScout: 200,
    buildingsUpdatesFocus: {
        "main_buildrow_farm": 5,
        "main_buildrow_smith": 3,
        "main_buildrow_storage": 5,
        "main_buildrow_main": 5,
        "main_buildrow_wall": 2,
        "main_buildrow_barracks": 1,
        "main_buildrow_stable": 1,
        "main_buildrow_garage": 1,
        "main_buildrow_snob": 2,
        "main_buildrow_place": 1,
        "main_buildrow_statue": 1,
        "main_buildrow_market": 2,
        "main_buildrow_wood": 4,
        "main_buildrow_stone": 4,
        "main_buildrow_iron": 4,
        // "main_buildrow_hide	": "",
    }
};

(async () => {
    const fileWrite = (text) => {
        const date = new Date();
        fs.appendFile('cronExecute.txt', `\n${date}: \n${text}`, function (err) {
            if (err) throw err;
        });
    };
    const urls = [];
    const browser = await puppeteer.launch({
        headless: settings.headless,
        timeout: 216000000
    });
    const page = await browser.newPage();
    await page.goto(`http://${settings.world}.infernal-wars.com`);

    await page.evaluate(async (login, password) => {
        document.getElementsByName("username")[0].value = login;
        document.getElementsByName("password")[0].value = password;
        document.getElementsByClassName("btn-login")[0].click();
    }, login, password);

    await page.waitForNavigation();

    await page.evaluate(async () => {
        document.getElementsByClassName("l-list-vertical is-multiple")[0].getElementsByTagName("a")[0].click();
    });
    await page.waitForNavigation();

    await page.goto(`http://${settings.world}.infernal-wars.com//game.php?village=1777&screen=overview_villages`);

    const allVillagesUrls = await page.evaluate(async (urls, settings) => {
        const tab = document.getElementsByClassName("vis")[1];
        const allTrs = Object.values(tab.getElementsByTagName("tr"));
        allTrs.forEach((elm) => {
            if (elm && elm.getElementsByTagName("a")[0]) {
                let url = "http://"+settings.world+".infernal-wars.com/" + elm.getElementsByTagName("a")[0].getAttribute("href");
                console.log("url: ", url.replace("overview", "main"));
                urls.push(url.replace("overview", "main"));
            }
        });
        return urls;
    }, urls, settings);

    if(settings.isUpdateBuildings) {
        //update lvl of buildings
        await Promise.mapSeries(allVillagesUrls, async (item) => {
            fileWrite("redirect: "+ item);
            await page.goto(item, {
                waitUntil: 'networkidle2',    // works
                timeout: 1000 * 60 * 20
            });

            try {
                let buildToConstruct = [];
                let buildingsConfig = (building) => {
                    for(let i=0; i<settings.buildingsUpdatesFocus[building.trim()]; i++) {
                        buildToConstruct.push(building);
                    }
                };

                const trs = [
                    "main_buildrow_farm	",
                    "main_buildrow_smith	",
                    "main_buildrow_storage	",
                    "main_buildrow_main	",
                    "main_buildrow_wall	",
                    "main_buildrow_barracks	",
                    "main_buildrow_stable	",
                    "main_buildrow_garage	",
                    "main_buildrow_snob	",
                    "main_buildrow_place	",
                    "main_buildrow_statue	",
                    "main_buildrow_market	",
                    "main_buildrow_wood	",
                    "main_buildrow_stone	",
                    "main_buildrow_iron	",
                    // "main_buildrow_hide	",
                ];
                trs.forEach((item)=> buildingsConfig(item));

                buildToConstruct.forEach(async (item) => {
                    await page.evaluate(async (item) => {
                        function hasClass(element, cls) {
                            if (element) {
                                return (' ' + element.className + ' ').indexOf(' ' + cls + ' ') > -1;
                            }
                            return true;
                        }

                        try {

                            let elm = document.getElementById(item);
                            let hasCompleted = hasClass(elm, "completed");
                            if (!hasCompleted) {
                                let tds = elm.getElementsByTagName("td");
                                let arrayTds = Object.values(tds);
                                let elmToClick = arrayTds.length >= 6 ? arrayTds[6].getElementsByTagName("a")[0] : null;
                                if (elmToClick) {
                                    setTimeout(() => {
                                        console.log("elmToClick: ", elmToClick);
                                        elmToClick.click()
                                    }, 100);
                                }
                            }

                            return trs;
                        } catch (e) {
                            console.log(e);
                            return null;
                        }
                    }, item);
                    setTimeout(async () => await page.reload(), 5000);
                });
            } catch (e) {
                console.log(e)
            }
            await page.waitForNavigation();
        });
    }

    if(settings.isUpdateBarracksUnit) {
        // //to barracks
        const barracksUrl = allVillagesUrls.map((item)=>{return item.replace("main", "barracks")});
        await Promise.mapSeries(barracksUrl, async (item)=> {
            await page.goto(item, {
                waitUntil: 'networkidle2',    // works
                timeout: 1000 * 60 * 20
            });
            await page.evaluate(()=> {
                const numberOfTypesUnits = 8;
                const allPop = document.getElementById("pop_max_label").textContent;
                const currentPop = document.getElementById("pop_current_label").textContent;
                const unitAvailableToConstruct = allPop-currentPop;
                function hasClass(element, cls) {
                    if (element) {
                        return (' ' + element.className + ' ').indexOf(' ' + cls + ' ') > -1;
                    }
                    return true;
                }
                const domUnits = document.getElementsByClassName("vis")[1];
                const domAllUnits = Object.values(domUnits.getElementsByTagName("tr"));
                domAllUnits.forEach((elm)=> {
                    let inputTd = elm.getElementsByTagName("td")[3];
                    let btnSubmit = document.getElementsByClassName("btn btn-recruit")[0];
                    if(!hasClass(inputTd, "inactive")) {
                        let perTroop = unitAvailableToConstruct > 0 ? Math.floor(parseInt(unitAvailableToConstruct / numberOfTypesUnits)) : 0;
                        let availableTroopsToCreate = parseInt(inputTd.getElementsByTagName("a")[0].textContent.replace("(","").replace(")",""));
                        let resolveNumberTroop = perTroop > availableTroopsToCreate ? availableTroopsToCreate : perTroop;
                        let inputNumberTroop = inputTd.getElementsByTagName("input")[0];
                        inputNumberTroop.value = resolveNumberTroop;
                        btnSubmit.click();
                    }
                });
                setTimeout(async () => await page.reload(), 5000);
            });
        });
    }

    if(settings.isUpdateStableUnits) {
        //to stable
        const stableUrls = allVillagesUrls.map((item) => {
            return item.replace("main", "stable")
        });
        await Promise.mapSeries(stableUrls, async (item) => {
            await page.goto(item, {
                waitUntil: 'networkidle2',    // works
                timeout: 1000 * 60 * 20
            });
            await page.evaluate(() => {

                if (document.querySelector("#leftcolumn > form > table")) {
                    const numberOfTypesUnits = 8;
                    const allPop = document.getElementById("pop_max_label").textContent;
                    const currentPop = document.getElementById("pop_current_label").textContent;
                    const unitAvailableToConstruct = allPop - currentPop;

                    function hasClass(element, cls) {
                        if (element) {
                            return (' ' + element.className + ' ').indexOf(' ' + cls + ' ') > -1;
                        }
                        return true;
                    }

                    const domUnits = document.getElementsByClassName("vis")[1];
                    const domAllUnits = Object.values(domUnits.getElementsByTagName("tr"));
                    domAllUnits.forEach((elm, index) => {
                        let inputTd = elm.getElementsByTagName("td")[3];
                        let btnSubmit = document.getElementsByClassName("btn btn-recruit")[0];
                        if (!hasClass(inputTd, "inactive")) {
                            let perTroop = unitAvailableToConstruct > 0 ? Math.floor(parseInt(unitAvailableToConstruct / numberOfTypesUnits)) : 0;
                            let availableTroopsToCreate = parseInt(inputTd.getElementsByTagName("a")[0].textContent.replace("(", "").replace(")", ""));
                            let resolveNumberTroop = perTroop > availableTroopsToCreate ? availableTroopsToCreate : perTroop;
                            let inputNumberTroop = inputTd.getElementsByTagName("input")[0];
                            if (index === 1) {
                                resolveNumberTroop = settings.defaultNumberScout > availableTroopsToCreate ? availableTroopsToCreate : settings.defaultNumberScout;
                            }
                            inputNumberTroop.value = resolveNumberTroop;
                            btnSubmit.click();
                        }
                    });
                    setTimeout(async () => await page.reload(), 5000);
                }
            });
        });
    }

    await browser.close();
})();
