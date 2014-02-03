require(["../mailbuild"], function(mailbuild) {

    function log(str){
        document.getElementById("target").innerHTML = String(str).replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    var mail = mailbuild("multipart/signed; micalg=pgp-sha256; protocol=application/pgp-signature", {
        baseBoundary: "abcdef"
    });

    mail.setHeader({
        from: pgp_keys.address,
        to: "test <test@kreata.ee>",
        subject: "PGP Signature Demo"
    });

    var multipart = mail.addChild("multipart/mixed");

    var altNode = multipart.addChild("multipart/alternative");

    multipart.addChild("image/png", {filename: "image.png"}).setContent("BINARY_DATA");

    altNode.
        addChild({filename: "test.txt"}).
        setContent("Bacon ipsum dolor sit amet pastrami hamburger beef ribs fatback. Beef ribs sausage ham, tail jerky flank rump capicola ham hock ball tip. Pancetta t-bone pig, kevin tongue salami short ribs shank sausage sirloin venison beef cow doner swine. Filet mignon shank ball tip, pig ham hock shankle jerky swine boudin porchetta frankfurter pastrami. Tenderloin chuck salami meatball.");

    altNode.
        addChild("text/html").
        setContent("<p>Hello world!</p>");

    altNode.
        addChild("text/html").
        setContent('<p lang="ru" xml:lang="ru" dir="ltr">\nНо пожжэ омйттам жкаывола ыюм, зыд ыёрмод аюдирэ чингюльищ нэ. Йн ыюм кашы волумюч, векж ты лебыр констятюам, зыд экз бландит янвыняры. Ат пырикульа пэржыкюти дуо, эрож адхюк доктюж экз нам, эож ку апэриам жплэндидэ модыратиюз. Магна торквюатоз эож ат. Пюрто зальютатуж но векж. Зймюл оффекйяж вэл ыт. Ад ыёюз интыллыгам вим, ты нам эуежмод нолюёжжэ, нам но дйкит корпора опортэат.\n  </p>');

    mail.
        addChild("application/pgp-signature").
        setHeader("content-transfer-encoding", "7bit").
        setHeader("content-id", "abcd@ef").
        setContent(sign(multipart.build()));

    // build entire message
    var mailBody = mail.build();

    function sign(str){
        openpgp.config.prefer_hash_algorithm = openpgp.enums.hash.sha256;
        var privKey = openpgp.key.readArmored(pgp_keys.private_key).keys[0];
        privKey.getSigningKeyPacket().decrypt(pgp_keys.passphrase);
        return "-----BEGIN PGP SIGNATURE-----" + 
            openpgp.signClearMessage([privKey], str).
               split("-----BEGIN PGP SIGNATURE-----").pop();
    }

    log(mailBody);
});



