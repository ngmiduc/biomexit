/* eslint-disable no-console */
"use strict"

console.log("[printer] start local NODEjs server")
console.log("[printer] PRINTER server is starting")

const axios = require("axios")
const admin = require("firebase-admin")
const usb = require("usb")
const escpos = require("escpos")
const sharp = require("sharp")
const fs = require("fs")
const cerd = require("./cred.json")
const ESCPOSImageProcessor = require("escpos-image-processor")
const processor = new ESCPOSImageProcessor({
  width: 185,
  quality: "best"
})

sharp.cache(false)

admin.initializeApp({
  credential: admin.credential.cert(cerd),
  storageBucket: "biomexit.appspot.com"
})

console.log("[printer] init database")
var bucket = admin.storage().bucket()
var firestore = admin.firestore()

const list = usb.getDeviceList()
console.log("[printer] get USB device list")
let pid = null
let vid = null

list.forEach(d => {
  console.log("[printer] get device")
  if (
    d.deviceDescriptor.bcdDevice == 256 &&
    d.deviceDescriptor.bMaxPacketSize0 == 64
  ) {
    console.log("[printer] found printer")
    vid = d.deviceDescriptor.idVendor
    pid = d.deviceDescriptor.idProduct
    console.log("[printer] get VID and PID", { vid, pid })
  }
})

const device = new escpos.USB(vid, pid) //'0x04b8','0x0202'
const printer = new escpos.Printer(device, { encoding: "GB18030" })

console.log("[printer] device : ", device)

let BUSY = false
let OPENED = false

firestore
  .collection("faces")
  .orderBy("date", "desc")
  .limit(1)
  .onSnapshot(querySnapshot => {
    console.log("")
    console.log("[detecting new data ...]")
    console.log("")

    let tmp = []
    querySnapshot.forEach(doc => {
      tmp.push({ id: doc.id, data: doc.data(), meta: doc.metadata })
    })

    let item = {
      url: tmp[0].data.url,
      id: tmp[0].id,
      analysis: tmp[0].data.analysis
    }
    console.log("")
    console.log("[get data] GET new data from tracking ...")

    if (!BUSY) {
      BUSY = true

      let today = new Date()
      let valid = new Date()
      valid.setTime(valid.getTime() + 1 * 60000)

      let fileName = item.url
        .split("iomexit.appspot.com/o/faces%2")[1]
        .split(".jpg")[0]
      fileName = `faces/${fileName}.jpg`
      const file = bucket.file(fileName)
      console.log("FILE : " + fileName)
      console.log("FILE : " + file)

      file
        .getSignedUrl({
          action: "read",
          expires: valid
        })
        .then(signedUrls => {
          const sURL = signedUrls[0]
          valid = valid.toISOString().split("T")[0]

          console.log("[data fetching] get signed URL : " + sURL)
          console.log("[data fetching] valid until : " + valid)

          fs.unlink("source.png", async function(err) {
            if (err) throw err
            // if no error, file has been deleted successfully
            console.log("[file server] old file deleted!")

            async function downloadImage() {
              const writer = fs.createWriteStream("source.png")
              const url = item.url
              const response = await axios({
                url,
                method: "GET",
                responseType: "stream"
              })

              response.data.pipe(writer)

              return new Promise((resolve, reject) => {
                writer.on("finish", resolve)
                writer.on("error", reject)
              })
            }

            await downloadImage()
            console.log("[file server] set new file")

            fs.unlink("processed.png", async function(err) {
              if (err) throw err

              console.log("[file server] delete old file (2)")

              sharp("source.png")
                .resize({ width: 500, height: 300 })
                .grayscale()
                .toFile("processed.png")
                .then(function() {
                  console.log("[file server] save new file (2)")
                  console.log("[file server] FILE RESIZED")
                  console.log("[file server] URL is " + item.url)
                  console.log("[get data] timedate: ", today)

                  processor
                    .convert("processed.png", "ESCPOS.png")
                    .then(path => {
                      if (path) {
                        console.log(
                          `[file server processor] Processed image saved to ${path}, printing...`
                        )

                        // processor.print(device, printer)
                      } else {
                        console.log("[file server processor] An Error Occurred")
                      }

                      escpos.Image.load("ESCPOS.png", function(image) {
                        if (OPENED) {
                          console.log("[printer] already OPENED ...")
                          return
                        }

                        OPENED = true
                        device.open(async function() {
                          console.log("[printer] open printer ...")

                          let state = [
                            "single",
                            "married",
                            "divorced",
                            "celibate",
                            "unknown",
                            "open",
                            "widow",
                            "role"
                          ]
                          let age = Math.floor(Math.random(1) * 30 + 20)
                          let rating = Math.floor(Math.random(1) * 1000000)
                          let barcode = Math.floor(
                            Math.random() * 899999999999 + 100000000000
                          )

                          console.log("[get data] meta information: ", {
                            age,
                            rating
                          })
                          console.log("[get data] code: ", barcode)

                          for (var i = 0; i < 5; i++) {
                            console.log(
                              "[fetching ...] " +
                                Math.floor(
                                  Math.random() * 899999999999 + 100000000000
                                )
                            )
                          }

                          await printer.font("a")
                          await printer.align("ct")
                          await printer.style("bu")
                          await printer.size(1, 1)
                          await printer.image(image, "s8")
                          await printer.text("")
                          await printer.text("BIOMETRIC EXIT")
                          await printer.text("")
                          await printer.text("TIME " + today)
                          await printer.text("ID " + item.id)
                          await printer.text("ANALYSIS " + item.analysis)
                          await printer.text(
                            "STATE " + state[Math.floor(Math.random() * 8)]
                          )
                          await printer.text("RATING " + rating)
                          await printer.text("AGE: " + age)
                          await printer.barcode("" + barcode, "EAN13")
                          await printer.text("")

                          // await printer.image(image, "d8")
                          // await printer.image(image, "s24")
                          // await printer.image(image, "d24")
                          //
                          // await printer.raster(image)
                          // await printer.raster(image, "dw")
                          // await printer.raster(image, "dh")
                          // await printer.raster(image, "dwdh")
                          await printer.close()
                          OPENED = false
                          BUSY = false
                        })
                      })
                    })
                    .catch(error => console.error(error))
                })
            })
          })
        })
    } else {
      console.log("[SERVER OVERLOAD")
      console.log("[BLOCK DATA]")
      console.log("[BLOCK DATA]")
      console.log("[BLOCK DATA]")
    }
  })
