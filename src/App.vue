<template>
  <div id="app">
    <!-- <button type="button" name="button" @click="tick()"></button> -->
    <div id="login" v-if="!auth"></div>
    <div v-if="auth" class="gallery">
      <preview
        :data="item"
        v-for="(item, index) in faces"
        :key="item.id"
        :newItem="index === pos ? true : false"
      >
      </preview>
    </div>
  </div>
</template>

<script>
import Vue from "vue"
import { db, firebase } from "./firebase.js"
import * as firebaseui from "firebaseui"

import Preview from "@/components/Preview"
import axios from "axios"

export default {
  name: "app",
  components: { Preview },
  data() {
    return {
      limit: 20,
      auth: false,
      faces: [],
      pos: null
    }
  },
  methods: {
    tick(f, id, analysis) {
      let file = f
        ? f
        : "https://firebasestorage.googleapis.com/v0/b/biomexit.appspot.com/o/faces%2FtOGjxf5MQBe6KKaQYtoR.jpg?alt=media&token=f0a57335-abea-4a69-9374-9a644d264300"

      file = file.split("biomexit.appspot.com/o/faces%2")[1]
      file = file.split(".jpg")[0]
      console.log(file)

      let idX = id ? id : undefined
      let analysisX = analysis ? analysis : undefined

      axios.post("http://192.168.1.52:3000", {
        image: file,
        id: idX,
        analysis: analysisX
      })
    },
    getData() {
      db.collection("faces")
        .orderBy("date", "desc")
        .limit(this.limit + 1)
        .get()
        .then(querySnapshot => {
          let tmp = []
          querySnapshot.forEach(doc => {
            tmp = [...tmp, { id: doc.id, data: doc.data(), meta: doc.metadata }]
          })

          tmp.shift()
          this.faces = tmp
        })

      db.collection("faces")
        .orderBy("date", "desc")
        .limit(1)
        .onSnapshot(querySnapshot => {
          // console.log("get DATA")
          let tmp = []
          querySnapshot.forEach(doc => {
            tmp.push({ id: doc.id, data: doc.data(), meta: doc.metadata })
          })
          let pos = Math.floor(Math.random() * Math.floor(20))
          // console.log("put DATA in POS " + pos)
          // console.log(tmp[0])
          this.pos = pos
          Vue.set(this.faces, pos, tmp[0])
          console.log("get new cctv")

          // this.tick(tmp[0].data.url, tmp[0].id, tmp[0].data.analysis)
        })
    }
  },
  created() {
    const uiConfig = {
      signInOptions: [firebase.auth.EmailAuthProvider.PROVIDER_ID],
      callbacks: {
        signInSuccessWithAuthResult: () => {
          this.auth = true
          this.getData()
          return false
        }
      }
    }

    firebase.auth().onAuthStateChanged(user => {
      if (user) {
        console.log("ADMIN LOGGED IN")
        this.auth = true
        this.getData()
      } else {
        console.log("LOG IN")

        const login = new firebaseui.auth.AuthUI(firebase.auth())
        login.start("#login", uiConfig)
      }
    })
  },
  mounted() {}
}
</script>

<style lang="scss">
@import "@/scss/login.scss";

body,
html {
  margin: 0;
  padding: 0;
}

* {
  font-family: Courier;
}

#app {
  font-family: "Avenir", Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  height: 100vh;
  width: 100vw;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: black;
}

$color: blue;

.gallery {
  height: 100%;
  width: 100%;
  display: flex;
  flex-wrap: wrap;
  border: 2px solid $color;
  box-sizing: border-box;
}
</style>
