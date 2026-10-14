import SwiftUI
import AppKit

struct CalendarLibraryView: View {
    @ObservedObject var model: CompanionModel
    @State private var month = Calendar.current.dateInterval(of: .month, for: Date())!.start
    @State private var events: [FrameEvent] = []
    @State private var status = ""
    private var days: [String] { Array(Set(events.map(\.startDay))).sorted() }

    var body: some View {
        Group {
            if !model.calendarAccess && !model.isDemo { LibraryPermissionState(model: model, permission: .calendar) }
            else { libraryContent }
        }
    }
    private var libraryContent: some View {
        HStack(alignment: .top, spacing: 0) {
            CalendarSources(model: model).frame(width: 310)
            Divider()
        VStack(spacing: 0) {
            HomeFilterBar {
                Text(month.formatted(.dateTime.month(.wide)))
                    .font(.title3.weight(.semibold))
                Text(month.formatted(.dateTime.year()))
                    .font(.title3).foregroundStyle(.secondary)
                Spacer()
                HStack(spacing: 0) {
                    Button { move(-1) } label: { HomeIcon( "chevron-left").frame(width: 24) }
                        .help("Previous month").accessibilityLabel("Previous month")
                    Button("Today") { month = Calendar.current.dateInterval(of: .month, for: Date())!.start; load() }
                        .padding(.horizontal, 8)
                    Button { move(1) } label: { HomeIcon( "chevron-right").frame(width: 24) }
                        .help("Next month").accessibilityLabel("Next month")
                }.controlSize(.small)
            }
            if model.selectedCalendars.isEmpty {
                HomeEmptyState("Choose your calendars", systemImage: "calendar", description: "Select one or more calendars from the list alongside this preview.")
            } else if !status.isEmpty {
                HomeEmptyState(status, systemImage: "calendar")
            } else {
                ScrollView {
                    LazyVStack(spacing: 0) {
                        ForEach(days, id: \.self) { day in
                            HStack(alignment: .top, spacing: 26) {
                                dateLabel(day)
                                VStack(alignment: .leading, spacing: 0) {
                                    ForEach(events.filter { $0.startDay == day }) { event in
                                        eventRow(event)
                                    }
                                }.frame(maxWidth: .infinity, alignment: .leading)
                            }
                            .padding(.vertical, 18)
                            if day != days.last { Divider().padding(.leading, 84) }
                        }
                    }.padding(.horizontal, HomeDesign.pageInset).padding(.bottom, HomeDesign.pageInset)
                }
            }
        }
        }
        .background(HomeDesign.canvas)
        .safeAreaInset(edge: .bottom) { HomeFooter { Text(model.selectionSummary).font(.caption).foregroundStyle(.secondary); Spacer(); SharingButton(model: model) } }
        .onAppear(perform: load)
        .onChange(of: model.selectedCalendars) { _, _ in load() }
        .onChange(of: model.calendarAppearances) { _, _ in load() }
        .onChange(of: model.calendarAccess) { _, _ in load() }
        .onChange(of: model.lastUpdated) { _, _ in load() }
    }
    private func dateLabel(_ day: String) -> some View {
        let date = parser().date(from: day) ?? month
        let today = Calendar.current.isDateInToday(date)
        return VStack(spacing: 4) {
            Text(date.formatted(.dateTime.weekday(.abbreviated)).uppercased())
                .font(.system(size: 10, weight: .semibold)).tracking(1)
                .foregroundStyle(today ? Color.red : Color.secondary)
            Text(date.formatted(.dateTime.day()))
                .font(.system(size: 26, weight: today ? .medium : .regular, design: .rounded))
                .foregroundStyle(today ? Color.white : Color.primary)
                .frame(width: 42, height: 42)
                .background { if today { Circle().fill(Color.red) } }
        }
        .frame(width: 58).padding(.top, 6)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(dayTitle(day) + (today ? ", Today" : ""))
    }

    private func eventRow(_ event: FrameEvent) -> some View {
        HStack(alignment: .top, spacing: 14) {
            RoundedRectangle(cornerRadius: 2)
                .fill(eventColor(event)).frame(width: 3)
                .padding(.vertical, 3)
            VStack(alignment: .leading, spacing: 5) {
                Text((event.allDay ? "All day" : time(event.start)) + (event.calendarDisplayName.map { " – \($0)" } ?? ""))
                    .font(.system(size: 12, weight: .medium)).foregroundStyle(eventColor(event))
                Text(event.title).font(.system(size: 14, weight: .medium))
                    .fixedSize(horizontal: false, vertical: true)
                Text(event.calendar).font(.system(size: 11)).foregroundStyle(.secondary)
                if event.allDay && event.endDay > nextDay(event.startDay) {
                    Text("Through \(dayTitle(previousDay(event.endDay)))")
                        .font(.caption).foregroundStyle(.secondary)
                }
            }.frame(maxWidth: .infinity, alignment: .leading)
        }
        .fixedSize(horizontal: false, vertical: true)
        .padding(.vertical, 10)
        .accessibilityElement(children: .combine)
    }

    private func eventColor(_ event: FrameEvent) -> Color {
        guard let hex = event.calendarColor, let color = CalendarAppearance.color(from: hex) else { return .accentColor }
        return Color(nsColor: color)
    }

    private func move(_ direction: Int) { month = Calendar.current.date(byAdding: .month, value: direction, to: month)!; load() }
    private func load() {
        let end = Calendar.current.date(byAdding: .month, value: 1, to: month)!
        let result = model.calendarEvents(from: month, to: end, limit: 10000)
        events = result.0
        status = result.1.state != "ready" ? result.1.message : events.isEmpty ? "No events this month" : ""
    }
    private func time(_ value: String) -> String { ISO8601DateFormatter().date(from: value)?.formatted(date: .omitted, time: .shortened) ?? value }
    private func parser() -> DateFormatter { let f = DateFormatter(); f.locale = Locale(identifier: "en_US_POSIX"); f.dateFormat = "yyyy-MM-dd"; return f }
    private func dayTitle(_ day: String) -> String { parser().date(from: day)?.formatted(.dateTime.weekday(.wide).month(.wide).day()) ?? day }
    private func nextDay(_ day: String) -> String { shift(day, 1) }
    private func previousDay(_ day: String) -> String { shift(day, -1) }
    private func shift(_ day: String, _ value: Int) -> String { let f = parser(); guard let d = f.date(from: day), let n = Calendar.current.date(byAdding: .day, value: value, to: d) else { return day }; return f.string(from: n) }
}

struct PhotoLibraryView: View {
    @ObservedObject var model: CompanionModel
    @StateObject private var playback = PhotoPlaybackSettingsModel()
    @State private var hiddenOnly = false
    @State private var selected: FramePhoto?
    @State private var dropTarget: String?
    @State private var dropAtEnd = false
    private var photos: [FramePhoto] { model.photoSelection.ordered(model.libraryPhotos).filter { hiddenOnly == model.photoSelection.hidden.contains($0.id) } }
    private var canReorder: Bool { !hiddenOnly && playback.order == .custom }
    var body: some View {
        Group {
            if !model.photoAccess && !model.isDemo { LibraryPermissionState(model: model, permission: .photos) }
            else { libraryContent }
        }
    }
    private var libraryContent: some View {
        VStack(spacing: 0) {
            HomeFilterBar {
                Picker("Album", selection: $model.selectedAlbum) {
                    Text("Choose an album").tag("")
                    ForEach(model.albums, id: \.localIdentifier) { album in Text(album.localizedTitle ?? "Shared album").tag(album.localIdentifier) }
                }.frame(maxWidth: 350, alignment: .leading)
                Spacer()
                Picker("Show", selection: $hiddenOnly) { Text("On Frame").tag(false); Text("Hidden").tag(true) }.pickerStyle(.segmented).labelsHidden().frame(width: 200, alignment: .trailing)
            }
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    PhotoPlaybackSettingsView(model: playback, folder: model.output)
                    HStack {
                        Text(hiddenOnly ? "Hidden photos" : "Photos on your frame").font(.headline)
                        Spacer()
                        Text(hiddenOnly ? "Restore a photo to include it again." : playback.order == .random ? "Switch to Custom order to arrange photos." : "Drag a photo onto another to place it before that photo.")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                    if photos.isEmpty {
                        HomeEmptyState(hiddenOnly ? "No hidden photos" : "No photos on the frame", systemImage: "images", description: hiddenOnly ? "Photos you hide will appear here." : model.selectedAlbumName.map { "To add photos, share to ‘\($0)’ from your iPhone or Mac." } ?? "Choose a shared album above to get started.")
                            .frame(minHeight: 220)
                    } else {
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 175, maximum: 240))], spacing: 16) {
                        ForEach(Array(photos.enumerated()), id: \.element.id) { index, photo in
                            VStack(spacing: 8) {
                                PhotoThumbnail(url: photoURL(photo))
                                    .frame(height: 150).frame(maxWidth: .infinity).background(.black.opacity(0.06)).clipShape(RoundedRectangle(cornerRadius: HomeDesign.cornerRadius))
                                    .contentShape(Rectangle()).onTapGesture { selected = photo }
                                HStack {
                                    if !hiddenOnly {
                                        Text("\(index + 1)").font(.caption.monospacedDigit()).foregroundStyle(.secondary)
                                        if playback.order == .custom { HomeIcon( "grip").font(.caption).foregroundStyle(.secondary) }
                                    }
                                    Spacer()
                                    Button(hiddenOnly ? "Restore" : "Hide") { model.setPhotoVisible(photo.id, visible: hiddenOnly) }
                                }.controlSize(.small).disabled(model.busy)
                            }
                            .draggable(canReorder ? "homecontrol-photo:\(photo.id)" : "")
                            .padding(8)
                            .background(HomeDesign.surface, in: RoundedRectangle(cornerRadius: HomeDesign.cornerRadius))
                            .overlay(alignment: .leading) {
                                if canReorder && dropTarget == photo.id {
                                    RoundedRectangle(cornerRadius: 2).fill(Color.accentColor).frame(width: 3).padding(.vertical, 6)
                                }
                            }
                            .dropDestination(for: String.self) { items, _ in
                                moveDroppedPhoto(items, before: photo.id)
                            } isTargeted: { targeted in
                                if targeted { dropTarget = photo.id } else if dropTarget == photo.id { dropTarget = nil }
                            }
                            .contextMenu {
                                Button("Move earlier") { move(photo.id, by: -1) }.disabled(!canReorder || index == 0)
                                Button("Move later") { move(photo.id, by: 1) }.disabled(!canReorder || index == photos.count - 1)
                            }
                            .accessibilityElement(children: .contain)
                            .accessibilityLabel("Photo \(index + 1), \(photo.caption)")
                            .accessibilityAction(named: "Move earlier") { if canReorder { move(photo.id, by: -1) } }
                            .accessibilityAction(named: "Move later") { if canReorder { move(photo.id, by: 1) } }
                        }
                    }
                    if canReorder {
                        HomeLabel("Drop here to move to the end", icon: "arrow-down-to-line")
                            .font(.callout).foregroundStyle(dropAtEnd ? Color.accentColor : .secondary)
                            .frame(maxWidth: .infinity).padding(14)
                            .background(dropAtEnd ? Color.accentColor.opacity(0.1) : Color.clear, in: RoundedRectangle(cornerRadius: 8))
                            .overlay(RoundedRectangle(cornerRadius: 8).strokeBorder(.secondary.opacity(0.3), style: StrokeStyle(lineWidth: 1, dash: [4])))
                            .dropDestination(for: String.self) { items, _ in moveDroppedPhoto(items, before: nil) } isTargeted: { dropAtEnd = $0 }
                    }
                    }
                }.padding(HomeDesign.pageInset)
            }
            HomeFooter { Text("\(photos.count) photos").font(.caption).foregroundStyle(.secondary); Spacer(); SharingButton(model: model) }
        }
        .onAppear { model.loadPhotoCatalog(); playback.load(folder: model.output) }
        .onChange(of: model.output) { _, folder in playback.load(folder: folder) }
        .onReceive(Timer.publish(every: 15, on: .main, in: .common).autoconnect()) { _ in
            if !playback.hasChanges && !playback.loadFailed { playback.load(folder: model.output) }
        }
        .sheet(item: $selected) { photo in
            VStack {
                PhotoThumbnail(url: photoURL(photo)).frame(minWidth: 700, minHeight: 480)
                HStack { Text(photo.caption).foregroundStyle(.secondary); Spacer(); Button("Done") { selected = nil }.keyboardShortcut(.cancelAction) }.padding()
            }.padding()
        }
    }
    private func photoURL(_ photo: FramePhoto) -> URL? { model.output?.appendingPathComponent("media/\(photo.id).jpg") }
    private func moveDroppedPhoto(_ items: [String], before target: String?) -> Bool {
        guard canReorder, items.count == 1, let item = items.first, item.hasPrefix("homecontrol-photo:") else { return false }
        let id = String(item.dropFirst("homecontrol-photo:".count))
        guard photos.contains(where: { $0.id == id }), target != id else { return false }
        model.movePhoto(id, before: target)
        return true
    }
    private func move(_ id: String, by offset: Int) {
        guard let index = photos.firstIndex(where: { $0.id == id }), photos.indices.contains(index + offset) else { return }
        let destination = offset < 0 ? index - 1 : index + 2
        model.movePhoto(id, before: photos.indices.contains(destination) ? photos[destination].id : nil)
    }
}

private struct PhotoThumbnail: View {
    let url: URL?
    @State private var image: NSImage?
    var body: some View {
        Group { if let image { Image(nsImage: image).resizable().scaledToFit() } else { HomeIcon( "image").foregroundStyle(.secondary) } }
            .task(id: url) { image = url.flatMap { NSImage(contentsOf: $0) } }
    }
}
