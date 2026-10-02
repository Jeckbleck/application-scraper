# application-scraper

Chrome extension that exports the LinkedIn job posting you're viewing to a plain `.txt` file with one click.

## Install (unpacked)

1. Open `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. Click **Load unpacked** and select the `extension/` folder

## Use

Open any LinkedIn job, either at `linkedin.com/jobs/view/<id>` or by selecting a job in the search/collections list.
Click the blue **Export .txt** button in the bottom-right corner. The file is saved to your Downloads folder as
`Company - Job Title.txt`, containing the title, company, URL, details, highlights and the full description.

After editing the extension files, hit the reload icon on the extension card in `chrome://extensions` and refresh the LinkedIn tab.
