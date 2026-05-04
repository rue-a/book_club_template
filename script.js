// Returns the formatted average across all fully-rated books.
function averageOfAllRatings(books, rs) {
	const allValues = books
		.filter(book => hasRatings(book, rs))
		.flatMap(book => Object.values(book.ratings));

	if (allValues.length === 0) return "";

	return rs.format(rs.computeAverage(
		Object.fromEntries(allValues.map((v, i) => [i, v]))
	));
}



fetch("data/club.json").then(r => r.json())
	.then(async (club) => {
		const [books, { ratingSystem }, popupRatings, popupAverageGrade] = await Promise.all([
			fetch(club.books).then(r => r.json()),
			import(`./rating_systems/${club.rating_system_id}.js`),
			fetch(`html_snippets/rating_system_popup_${club.rating_system_id}.html`).then(r => r.text()),
			fetch(`html_snippets/average_popup_${club.rating_system_id}.html`).then(r => r.text()),
		]);
		renderPage(club, Object.values(books), ratingSystem, popupRatings, popupAverageGrade);
	});

function renderPage(club, books, rs, popupRatings, popupAverageGrade) {
	const popupRatingsHost = document.createElement("div");
	popupRatingsHost.innerHTML = popupRatings;
	const ratingsPopup = popupRatingsHost.firstElementChild;
	ratingsPopup.hidden = true;
	ratingsPopup.style.position = "absolute";
	document.body.appendChild(ratingsPopup);

	const popupAverageGradeHost = document.createElement("div");
	popupAverageGradeHost.innerHTML = popupAverageGrade;
	const averageGradePopup = popupAverageGradeHost.firstElementChild;
	averageGradePopup.classList.add("popup-auto-size")
	document.body.appendChild(averageGradePopup);

	// Compute the average grade
	const averageGrade = averageOfAllRatings(books, rs);
	// And adapt the .html responsible for the popup which uses the average grade
	const averageGradeValue = document.getElementById("averageGradeValue");
	averageGradeValue.innerHTML = averageGrade;

	const header = document.getElementById("header")
	document.title = club.name
	const title = document.createElement("span")
	title.className = "h1"
	title.textContent = document.title
	header.appendChild(title)

	const article = document.getElementById("works");
	const sortedBooks = sortBooksByReviewDate(books);
	sortedBooks.forEach(book => {
		article.appendChild(renderBook(book, club, rs, ratingsPopup, averageGradePopup, averageGradeValue));
	});

	// Footer
	const footer = document.getElementById("footer");
	if (club.github_repo) {
		const repoSpan = document.createElement("div");
		const repoLink = document.createElement("a");
		repoLink.href = club.github_repo;
		repoLink.textContent = club.github_repo.replace(/^https?:\/\//, "");
		repoSpan.appendChild(repoLink);
		footer.appendChild(repoSpan);
	}


	const ratingSystemDiv = document.createElement("div");
	const ratingSystemTrigger = document.createElement("span")
	ratingSystemTrigger.textContent = "rating system";
	ratingSystemTrigger.className = "popup-trigger";
	ratingSystemDiv.appendChild(ratingSystemTrigger)
	footer.appendChild(ratingSystemDiv);
	addPopup(ratingSystemTrigger, ratingsPopup);


}

function renderBook(book, club, rs, gradingPopup, averageGradePopup, averageGrade) {
	console.log(`Printing book section for ${book.meta.title}`)

	const section = document.createElement("section");


	// Title
	const h2 = document.createElement("h2");
	h2.textContent = book.meta.title
	h2.id = book.meta.key
	section.appendChild(h2);

	const margin_anchor = document.createElement("p")
	section.appendChild(margin_anchor)


	const h2_subtitle = document.createElement("p");
	h2_subtitle.className = "h2subtitle";
	h2_subtitle.textContent = `by ${book.meta.authors}`;
	section.appendChild(h2_subtitle)




	// Right margin book cover 
	if (book.meta.cover_url) {

		const cover_img = document.createElement("span");
		cover_img.className = "marginnote";

		const img = document.createElement("img");
		img.src = book.meta.cover_url;
		img.alt = book.meta.title;

		cover_img.appendChild(img);
		margin_anchor.appendChild(cover_img);
	}

	// metadata in margin note

	const margin_meta = document.createElement("span");
	margin_meta.className = "marginnote";

	const metaLines = [
		metaLine("Authors", book.meta.authors),
		// metaLine("Query", book.query),
		// metaLine("Review date", book.review_date),
		// metaLine("Proposed by", book.proposer),
		metaLine("First published", book.meta.first_publish_year),
		metaLine("Edition count", book.meta.edition_count),
		metaLine("Pages", book.meta.number_of_pages_median),
		metaLine("Subjects", book.meta.subjects),
		metaLine("Places", join(book.meta.place)),
		metaLine("Time", join(book.meta.time)),
		metaLine("OpenLibrary key", `<a href=https://openlibrary.org${book.meta.key}><code>${book.meta.key.replace("/works/", "")}</code></a>`),
		metaLine(
			"Wikidata ID",
			(book.meta.id_wikidata || [])
				.map(id => `<a href="https://www.wikidata.org/wiki/${id}"><code>${id}</code></a>`)
				.join(", ")
		)

	];

	margin_meta.innerHTML = metaLines.join("");

	margin_anchor.appendChild(margin_meta);


	// first sentence epigraph
	if (book.meta.first_sentence) {
		const fs_div = document.createElement("div")
		fs_div.className = "epigraph"
		const fs_blockquote = document.createElement("blockquote")
		const fs_text = document.createElement("p")
		fs_text.textContent = book.meta.first_sentence
		// const fs_footer = document.createElement("footer")
		// fs_footer.textContent = `first sentence`
		fs_blockquote.appendChild(fs_text)
		// fs_blockquote.appendChild(fs_footer)
		fs_div.appendChild(fs_blockquote)
		section.appendChild(fs_div)
	}







	// Description (Markdown)
	if (book.meta.description) {
		const desc = document.createElement("p");
		desc.innerHTML = marked.parse(book.meta.description);
		section.appendChild(desc);
	}

	// book review announcement
	const now = new Date();
	const review_date = new Date(book["review_date"])
	const lang = club.language || "en";
	const review_date_string = review_date.toLocaleDateString(lang, { month: 'long', day: 'numeric', year: 'numeric' });

	const review_title = document.createElement("h3");
	review_title.textContent = "Review";
	section.appendChild(review_title);


	if (!(review_date.getTime())) {
		const review_announcement_p = document.createElement("p")
		review_announcement_p.textContent = `A review date has not yet been set for ${book.meta.title}.`;
		section.appendChild(review_announcement_p)
		return section
	}

	if (review_date > now) {
		const review_announcement_p = document.createElement("p")
		review_announcement_p.textContent = `${book.meta.title} will be reviewed on ${review_date_string}.`;
		section.appendChild(review_announcement_p)
		return section
	}

	// Optional blocks. Only print ratings and review after the review date
	const bookHasRatings = hasRatings(book, rs);
	const bookHasReviews = hasReviews(book);



	if (bookHasRatings) {
		// Average rating
		const average_rating = rs.computeAverage(book.ratings);

		// create grade element
		const grade = document.createElement("span");
		grade.innerHTML = rs.format(average_rating);
		grade.style.fontWeight = "bold";

		const margin_ratings = document.createElement("span")
		margin_ratings.className = "marginnote";
		const metalines = [];

		for (let key of Object.keys(book.ratings)) {
			metalines.push(metaLine(key, rs.format(book.ratings[key])));
		}

		margin_ratings.innerHTML = metalines.join("");

		// Build review sentence from club template
		const template = club.review_sentence ||
			"On {{date}}, the {{club_name}} graded {{book}} with {{rating}}.";
		const parts = template
			.replace("{{date}}", "\x00DATE\x00")
			.replace("{{club_name}}", "\x00CLUB\x00")
			.replace("{{book}}", "\x00BOOK\x00")
			.replace("{{rating}}", "\x00RATING\x00")
			.split("\x00");

		const rating_p = document.createElement("p");
		rating_p.appendChild(margin_ratings);
		parts.forEach(part => {
			if (part === "DATE") rating_p.appendChild(document.createTextNode(review_date_string));
			else if (part === "CLUB") rating_p.appendChild(document.createTextNode(club.name));
			else if (part === "BOOK") rating_p.appendChild(document.createTextNode(book.meta.title));
			else if (part === "RATING") { rating_p.appendChild(grade); addPopup(grade, averageGradePopup); }
			else if (part) rating_p.appendChild(document.createTextNode(part));
		});
		section.appendChild(rating_p);
	}

	if (bookHasReviews) {
		for (let key of Object.keys(book.reviews)) {
			if (book.reviews[key]) {
				const stripMarkdown = (text) => text
					.replace(/\*\*(.+?)\*\*/g, '$1')   // bold **
					.replace(/__(.+?)__/g, '$1')        // bold __
					.replace(/\*(.+?)\*/g, '$1')        // italic *
					.replace(/_(.+?)_/g, '$1')          // italic _
					.replace(/~~(.+?)~~/g, '$1')        // strikethrough
					.replace(/`(.+?)`/g, '$1')          // inline code
					.replace(/^#{1,6}\s+/gm, '')        // headings
					.replace(/^[-*+]\s+/gm, '')         // unordered list markers
					.replace(/^\d+\.\s+/gm, '')         // ordered list markers
					.replace(/\[(.+?)\]\(.*?\)/g, '$1') // links
					.replace(/!\[.*?\]\(.*?\)/g, '');   // images
				const review_p = document.createElement("p");
				const reviewer = document.createElement("span");
				reviewer.textContent = key;
				reviewer.style.fontWeight = "bold";
				reviewer.style.marginRight = "1em";
				review_p.append(reviewer);
				const lines = stripMarkdown(book.reviews[key].trim())
					.replace(/\n+/g, "\n")
					.split("\n");
				lines.forEach((line, i) => {
					if (i > 0) {
						review_p.append(document.createElement("br"));
						const indent = document.createElement("span");
						indent.style.display = "inline-block";
						indent.style.marginTop = "1pt";
						indent.style.textIndent = "1em";
						indent.textContent = line;
						review_p.append(indent);
					} else {
						review_p.append(document.createTextNode(line));
					}
				});
				review_p.style.fontStyle = "italic";
				section.appendChild(review_p);
			}
		}
	}





	return section;
}

function addPopup(popupTrigger, popup) {
	popupTrigger.addEventListener("mouseenter", () => {
		const spacing = 6;

		// Make popup visible but hidden so size can be measured
		popup.style.visibility = "hidden";
		popup.style.display = "block";

		const rect = popupTrigger.getBoundingClientRect();
		const popupRect = popup.getBoundingClientRect();

		let top = rect.bottom + spacing + window.scrollY; // default below
		let left = rect.left + window.scrollX;

		// If popup overflows bottom of viewport, place it above
		if (top + popupRect.height > window.scrollY + window.innerHeight) {
			top = rect.top - popupRect.height - spacing + window.scrollY;
		}

		// If popup overflows right edge, shift left
		if (left + popupRect.width > window.scrollX + window.innerWidth) {
			left = window.scrollX + window.innerWidth - popupRect.width - spacing;
		}

		if (left < window.scrollX) {
			left = window.scrollX + spacing;
		}

		popup.style.top = `${top}px`;
		popup.style.left = `${left}px`;

		// Now show it properly
		popup.style.visibility = "visible";
	});


	popupTrigger.addEventListener("mouseleave", () => {
		// delay hiding to allow moving into popup
		setTimeout(() => {
			if (!popup.matches(':hover')) {
				popup.style.display = "none";
			}
		}, 100);
	});

	popup.addEventListener("mouseleave", () => {
		popup.style.display = "none";
	});
}

function metaLine(key, value) {
	return value ? `<strong>${key}:</strong> ${value}<br>` : "";
}

function join(v) {
	return Array.isArray(v) ? v.join(", ") : v;
}


function hasRatings(book, rs) {
	const ratingsObj = book.ratings
	const title = book.meta.title

	if (!ratingsObj || Object.keys(ratingsObj).length === 0) {
		console.warn(`No ratings found (${title}).`);
		return false;
	}

	// only show ratings if every member has submitted one
	for (let key of Object.keys(ratingsObj)) {
		if (ratingsObj[key] === null || ratingsObj[key] === undefined) {
			console.warn(`Not everyone has rated yet (${title}).`);
			return false;
		}
		if (!rs.isValid(ratingsObj[key])) {
			console.warn(`Invalid rating value "${ratingsObj[key]}" (${title}).`);
			return false;
		}
	}
	return true;
}

function hasReviews(book) {
	const reviews = book.reviews
	
	if (!reviews || Object.keys(reviews).length === 0) {
		console.warn(`No reviews found (${book.meta.title}).`)
		return false; // no reviews, return null		
	}


	return true
}


function sortBooksByReviewDate(books) {
	return books.slice().sort((a, b) => {
		const dateA = new Date(a.review_date);
		const dateB = new Date(b.review_date);

		const timeA = isNaN(dateA.getTime()) ? -Infinity : dateA.getTime();
		const timeB = isNaN(dateB.getTime()) ? -Infinity : dateB.getTime();

		// Sort descending: latest dates first
		if (timeA === -Infinity && timeB === -Infinity) return 0;
		if (timeA === -Infinity) return 1; // invalid dates go last
		if (timeB === -Infinity) return -1;
		return timeB - timeA;
	});
}
